/**
 * GDShader 语法诊断提供器
 * 使用 Parser 诊断 + Analyzer 语义诊断, 结合 AST 结构检查.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  SHADER_TYPES, BUILTIN_VARS, PROCESSOR_FUNCTIONS,
  PROCESSOR_FUNCTION_INFO,
} from '../data';
import { DocumentManager } from './document-manager';
import { NodeKind, FunctionDeclNode, BlockStmtNode } from '../parser/ast';
import { loc } from '../loc';

export class GDShaderDiagnosticsProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private docManager: DocumentManager;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(diagnosticCollection: vscode.DiagnosticCollection, docManager: DocumentManager) {
    this.diagnosticCollection = diagnosticCollection;
    this.docManager = docManager;
  }

  /** 更新诊断信息 (防抖 300ms) */
  updateDiagnostics(document: vscode.TextDocument): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.runDiagnostics(document);
    }, 300);
  }

  /** 执行诊断检查 */
  private runDiagnostics(document: vscode.TextDocument): void {
    const uri = document.uri.toString();
    const info = this.docManager.getOrUpdate(uri, document.getText());
    const diagnostics: vscode.Diagnostic[] = [];
    const { result } = info;

    // 1. Lexer 诊断
    for (const d of result.lexerDiagnostics) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(d.line, d.column, d.line, d.column + d.length),
        d.message,
        vscode.DiagnosticSeverity.Error
      ));
    }

    // 2. Parser 诊断
    for (const d of result.parserDiagnostics) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(
          d.range.start.line, d.range.start.column,
          d.range.end.line, d.range.end.column
        ),
        d.message,
        vscode.DiagnosticSeverity.Error
      ));
    }

    // 3. Analyzer 语义诊断 (重复定义、未定义变量)
    const semanticDiags = this.docManager.getSemanticDiagnostics(uri);
    for (const d of semanticDiags) {
      const severity = d.severity === 'error' ? vscode.DiagnosticSeverity.Error
        : d.severity === 'warning' ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Hint;
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(d.line, d.column, d.line, d.column + d.length),
        d.message,
        severity
      ));
    }

    // 3b. #include 诊断
    const analysis = info.analysis;
    if (analysis.hints) {
      const docDir = path.dirname(document.uri.fsPath);
      for (const inc of analysis.hints.includes) {
        const lineText = document.lineAt(inc.line).text;
        if (inc.redirectPath) {
          // 有 redirection: 检查重定向目标是否存在 (适用于所有类型的 include)
          const targetPath = path.resolve(docDir, inc.redirectPath);
          if (!fs.existsSync(targetPath)) {
            diagnostics.push(new vscode.Diagnostic(
              new vscode.Range(inc.line, 0, inc.line, lineText.length),
              loc('diag.redirect.notExist', inc.redirectPath),
              vscode.DiagnosticSeverity.Error
            ));
          }
        } else if (inc.isResPath && !inc.isIgnored) {
          // res:// 路径, 无 redirection 且未 ignore -> 置灰提示
          const diag = new vscode.Diagnostic(
            new vscode.Range(inc.line, 0, inc.line, lineText.length),
            loc('diag.resPath.unresolved', inc.path),
            vscode.DiagnosticSeverity.Hint
          );
          diag.tags = [vscode.DiagnosticTag.Unnecessary];
          diagnostics.push(diag);
        } else if (!inc.isResPath && !inc.isIgnored) {
          // 非 res:// 路径且无 redirection: 检查原始文件是否存在
          const targetPath = path.resolve(docDir, inc.path);
          if (!fs.existsSync(targetPath)) {
            diagnostics.push(new vscode.Diagnostic(
              new vscode.Range(inc.line, 0, inc.line, lineText.length),
              loc('diag.include.notFound', inc.path),
              vscode.DiagnosticSeverity.Error
            ));
          }
        }
      }
    }

    // 4. AST 结构级诊断
    const ast = result.ast;
    const shaderType = info.shaderType;

    // 4a. 必须存在 shader_type (.gdshaderinc 除外)
    if (!document.fileName.endsWith('.gdshaderinc') && !ast.shaderType) {
      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        loc('diag.missingShaderType'),
        vscode.DiagnosticSeverity.Error
      ));
    }

    // 4b. shader_type 值有效性
    if (ast.shaderType) {
      const typeName = ast.shaderType.typeName.value;
      if (!(SHADER_TYPES as readonly string[]).includes(typeName)) {
        const t = ast.shaderType.typeName;
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(t.line, t.column, t.line, t.column + t.length),
          loc('diag.unknownShaderType', typeName, SHADER_TYPES.join(', ')),
          vscode.DiagnosticSeverity.Error
        ));
      }
    }

    // 4c. 处理器函数约束
    const validProcessors = PROCESSOR_FUNCTIONS[shaderType as keyof typeof PROCESSOR_FUNCTIONS] || [];
    for (const decl of ast.declarations) {
      if (decl.kind !== NodeKind.FunctionDecl) continue;
      const fn = decl as FunctionDeclNode;
      if (!fn.isProcessorFunction) continue;

      // 检查处理器函数是否适用于当前 shader_type
      if (!validProcessors.includes(fn.name.value as any)) {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(fn.name.line, fn.name.column, fn.name.line, fn.name.column + fn.name.length),
          loc('diag.processorNotApplicable', fn.name.value, shaderType, validProcessors.join(', ')),
          vscode.DiagnosticSeverity.Warning
        ));
      }

      // 4d. discard 位置检查
      const fnInfo = PROCESSOR_FUNCTION_INFO.find(p => p.name === fn.name.value);
      if (fnInfo && !fnInfo.allowDiscard && fn.body) {
        this.checkDiscardInBlock(fn.body, fn.name.value, diagnostics);
      }

      // 4d-2. 处理器函数禁止 return 由 Analyzer 做语义级检查 (见 3. 部分)

      // 4e. 内置变量只读检查
      if (fn.body) {
        this.checkBuiltinVarAccessInBlock(fn.body, shaderType, fn.name.value, diagnostics);
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  /** 递归检查 discard 在不允许的函数中使用 */
  private checkDiscardInBlock(block: BlockStmtNode, fnName: string, diagnostics: vscode.Diagnostic[]): void {
    for (const stmt of block.statements) {
      if (stmt.kind === NodeKind.DiscardStmt) {
        const r = stmt.range;
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(r.start.line, r.start.column, r.end.line, r.end.column),
          loc('diag.discardNotAllowed', fnName),
          vscode.DiagnosticSeverity.Error
        ));
      }
      this.recurseIntoChildren(stmt, fnName, diagnostics, 'discard');
    }
  }

  /** 递归检查内置变量只读写入 */
  private checkBuiltinVarAccessInBlock(
    block: BlockStmtNode, shaderType: string, fnName: string, diagnostics: vscode.Diagnostic[]
  ): void {
    const vars = BUILTIN_VARS[shaderType]?.[fnName];
    if (!vars) return;

    for (const stmt of block.statements) {
      // 表达式语句中的赋值
      if (stmt.kind === NodeKind.ExpressionStmt) {
        const expr = (stmt as any).expression;
        if (expr?.kind === NodeKind.AssignExpr) {
          this.checkAssignTarget(expr.left, vars, fnName, diagnostics);
        }
      }
      this.recurseIntoChildrenForVarCheck(stmt, shaderType, fnName, diagnostics);
    }
  }

  private checkAssignTarget(left: any, vars: any[], fnName: string, diagnostics: vscode.Diagnostic[]): void {
    if (!left) return;
    if (left.kind === NodeKind.IdentifierExpr) {
      const varName = left.name.value;
      const bVar = vars.find((v: any) => v.name === varName);
      if (bVar && bVar.access === 'in') {
        diagnostics.push(new vscode.Diagnostic(
          new vscode.Range(left.name.line, left.name.column, left.name.line, left.name.column + left.name.length),
          loc('diag.builtinReadonly', varName, fnName),
          vscode.DiagnosticSeverity.Error
        ));
      }
    }
    if (left.kind === NodeKind.MemberExpr) {
      const obj = left.object;
      if (obj?.kind === NodeKind.IdentifierExpr) {
        const varName = obj.name.value;
        const bVar = vars.find((v: any) => v.name === varName);
        if (bVar && bVar.access === 'in') {
          diagnostics.push(new vscode.Diagnostic(
            new vscode.Range(obj.name.line, obj.name.column, obj.name.line, obj.name.column + obj.name.length),
            loc('diag.builtinReadonly', varName, fnName),
            vscode.DiagnosticSeverity.Error
          ));
        }
      }
    }
  }

  /** 递归进入子块 (用于 discard 检查) */
  private recurseIntoChildren(stmt: any, fnName: string, diagnostics: vscode.Diagnostic[], checkType: 'discard'): void {
    if (stmt.kind === NodeKind.BlockStmt) {
      this.checkDiscardInBlock(stmt, fnName, diagnostics);
    }
    if (stmt.kind === NodeKind.IfStmt) {
      if (stmt.thenBranch?.kind === NodeKind.BlockStmt) this.checkDiscardInBlock(stmt.thenBranch, fnName, diagnostics);
      if (stmt.elseBranch?.kind === NodeKind.BlockStmt) this.checkDiscardInBlock(stmt.elseBranch, fnName, diagnostics);
    }
    if (stmt.kind === NodeKind.ForStmt || stmt.kind === NodeKind.WhileStmt || stmt.kind === NodeKind.DoWhileStmt) {
      if (stmt.body?.kind === NodeKind.BlockStmt) this.checkDiscardInBlock(stmt.body, fnName, diagnostics);
    }
  }

  /** 递归进入子块 (用于只读变量检查) */
  private recurseIntoChildrenForVarCheck(stmt: any, shaderType: string, fnName: string, diagnostics: vscode.Diagnostic[]): void {
    if (stmt.kind === NodeKind.BlockStmt) {
      this.checkBuiltinVarAccessInBlock(stmt, shaderType, fnName, diagnostics);
    }
    if (stmt.kind === NodeKind.IfStmt) {
      if (stmt.thenBranch?.kind === NodeKind.BlockStmt) this.checkBuiltinVarAccessInBlock(stmt.thenBranch, shaderType, fnName, diagnostics);
      if (stmt.elseBranch?.kind === NodeKind.BlockStmt) this.checkBuiltinVarAccessInBlock(stmt.elseBranch, shaderType, fnName, diagnostics);
    }
    if (stmt.kind === NodeKind.ForStmt || stmt.kind === NodeKind.WhileStmt || stmt.kind === NodeKind.DoWhileStmt) {
      if (stmt.body?.kind === NodeKind.BlockStmt) this.checkBuiltinVarAccessInBlock(stmt.body, shaderType, fnName, diagnostics);
    }
  }
}
