/**
 * GDShader 文档管理器
 * 管理 per-document 的 AST 缓存和语义分析结果, 为所有 provider 提供统一的查询接口.
 * 在 extension.ts 中创建单例, 注入各 provider.
 */
import * as path from 'path';
import * as fs from 'fs';
import { parseShader, ParseResult } from '../parser';
import { NodeKind, FunctionDeclNode } from '../parser/ast';
import {
  Analyzer, AnalysisResult, SymbolInfo, SymbolKind,
  StructMemberInfo,
} from '../parser/analyzer';
import { scanHints } from '../parser/hint-scanner';

export interface DocumentInfo {
  /** 解析结果 */
  result: ParseResult;
  /** 语义分析结果 */
  analysis: AnalysisResult;
  /** shader_type 值 (便捷访问) */
  shaderType: string;
}

export class DocumentManager {
  private cache = new Map<string, DocumentInfo>();

  /** 更新文档的 AST + 语义分析. 返回解析结果. */
  update(uri: string, text: string): DocumentInfo {
    const result = parseShader(text);
    const shaderType = result.ast.shaderType?.typeName.value ?? 'spatial';

    // 1. 先预扫描 hints, 收集 include 信息
    const preHints = scanHints(text);

    // 2. 解析 include 文件, 收集外部符号
    const externalSymbols = this.collectIncludeSymbols(uri, preHints);

    // 3. 将外部符号传给 Analyzer, 使语义分析时就能识别 include 的符号
    const analyzer = new Analyzer();
    const analysis = analyzer.analyze(result.ast, text, externalSymbols);

    // 4. 同步 include 的 struct/function 信息到 analysis 结果中 (用于补全等功能)
    if (externalSymbols) {
      for (const [name, sym] of externalSymbols) {
        if (sym.kind === SymbolKind.Struct && sym.members && !analysis.structs.has(name)) {
          analysis.structs.set(name, sym.members);
        }
        if (sym.kind === SymbolKind.Function && !analysis.functions.has(name)) {
          analysis.functions.set(name, sym);
        }
      }
    }

    const info: DocumentInfo = { result, analysis, shaderType };
    this.cache.set(uri, info);
    return info;
  }

  /** 收集 include 文件中的外部符号 */
  private collectIncludeSymbols(uri: string, hints: import('../parser/hint-scanner').HintScanResult): Map<string, SymbolInfo> | undefined {
    if (!hints || hints.includes.length === 0) return undefined;

    // 从 file:// URI 提取文件路径
    let docPath: string;
    try {
      if (!uri.startsWith('file:')) return undefined;
      const url = new URL(uri);
      docPath = decodeURIComponent(url.pathname);
      if (process.platform === 'win32' && docPath.startsWith('/')) {
        docPath = docPath.substring(1);
      }
    } catch { return undefined; }
    if (!docPath) return undefined;
    const docDir = path.dirname(docPath);

    const externalSymbols = new Map<string, SymbolInfo>();

    for (const inc of hints.includes) {
      let targetPath: string | null = null;
      if (inc.redirectPath) {
        // 有 redirection 时, 始终使用重定向路径 (支持所有 include 类型)
        targetPath = path.resolve(docDir, inc.redirectPath);
      } else if (inc.isResPath) {
        // res:// 路径无 redirection → 跳过
        continue;
      } else if (!inc.isIgnored) {
        targetPath = path.resolve(docDir, inc.path);
      } else {
        continue;
      }
      if (!targetPath) continue;
      try {
        if (!fs.existsSync(targetPath)) continue;
        const incText = fs.readFileSync(targetPath, 'utf-8');
        const incResult = parseShader(incText);
        const incAnalyzer = new Analyzer();
        const incAnalysis = incAnalyzer.analyze(incResult.ast, incText);
        // 将 include 文件路径转为 URI
        const incUri = 'file:///' + targetPath.replace(/\\/g, '/');
        for (const [name, sym] of incAnalysis.globalScope.symbols) {
          if (sym.kind === SymbolKind.BuiltinFunction ||
              sym.kind === SymbolKind.BuiltinConstant ||
              sym.kind === SymbolKind.BuiltinVar) continue;
          if (externalSymbols.has(name)) continue;
          // 标记符号的来源文件
          const symCopy = { ...sym, sourceUri: incUri };
          // 如果是 struct, 也给 members 标记 sourceUri
          if (sym.kind === SymbolKind.Struct && sym.members) {
            symCopy.members = sym.members.map(m => ({ ...m, sourceUri: incUri }));
          }
          externalSymbols.set(name, symCopy);
        }
      } catch {
        // 忽略读取/解析错误
      }
    }

    return externalSymbols.size > 0 ? externalSymbols : undefined;
  }

  /** 获取文档的缓存信息 (不存在则返回 null) */
  get(uri: string): DocumentInfo | null {
    return this.cache.get(uri) ?? null;
  }

  /** 获取或创建文档信息 */
  getOrUpdate(uri: string, text: string): DocumentInfo {
    return this.cache.get(uri) ?? this.update(uri, text);
  }

  /** 删除文档缓存 */
  delete(uri: string): void {
    this.cache.delete(uri);
  }

  /** 查找指定行列所在的处理器函数名 */
  getProcessorFunctionAt(uri: string, line: number): string {
    const info = this.cache.get(uri);
    if (!info) return '';
    for (const decl of info.result.ast.declarations) {
      if (decl.kind !== NodeKind.FunctionDecl) continue;
      const fn = decl as FunctionDeclNode;
      if (!fn.isProcessorFunction) continue;
      if (line >= fn.range.start.line && line <= fn.range.end.line) {
        return fn.name.value;
      }
    }
    return '';
  }

  /** 查找指定行所在的任意函数 */
  getFunctionAt(uri: string, line: number): FunctionDeclNode | null {
    const info = this.cache.get(uri);
    if (!info) return null;
    for (const decl of info.result.ast.declarations) {
      if (decl.kind !== NodeKind.FunctionDecl) continue;
      const fn = decl as FunctionDeclNode;
      if (line >= fn.range.start.line && line <= fn.range.end.line) {
        return fn;
      }
    }
    return null;
  }

  /** 获取文档的 shader_type */
  getShaderType(uri: string): string {
    return this.cache.get(uri)?.shaderType ?? 'spatial';
  }

  /** 获取所有函数声明 */
  getFunctions(uri: string): FunctionDeclNode[] {
    const info = this.cache.get(uri);
    if (!info) return [];
    return info.result.ast.declarations.filter(
      (d): d is FunctionDeclNode => d.kind === NodeKind.FunctionDecl
    );
  }

  // ═══════════════════════════════════════════
  // 语义查询 (基于 Analyzer)
  // ═══════════════════════════════════════════

  /** 解析标识符: 在指定位置查找符号定义 */
  resolveSymbol(uri: string, name: string, line: number): SymbolInfo | undefined {
    const info = this.cache.get(uri);
    if (!info) return undefined;
    return Analyzer.resolveAtLine(info.analysis.globalScope, name, line);
  }

  /** 获取指定位置可见的所有符号 */
  getVisibleSymbols(uri: string, line: number): Map<string, SymbolInfo> {
    const info = this.cache.get(uri);
    if (!info) return new Map();
    return Analyzer.getVisibleSymbolsAtLine(info.analysis.globalScope, line);
  }

  /** 获取 struct 成员列表 */
  getStructMembers(uri: string, structName: string): StructMemberInfo[] {
    const info = this.cache.get(uri);
    if (!info) return [];
    return info.analysis.structs.get(structName) ?? [];
  }

  /** 获取语义诊断 */
  getSemanticDiagnostics(uri: string) {
    const info = this.cache.get(uri);
    if (!info) return [];
    return info.analysis.diagnostics;
  }

  /** 获取分析结果 */
  getAnalysis(uri: string): AnalysisResult | null {
    return this.cache.get(uri)?.analysis ?? null;
  }
}
