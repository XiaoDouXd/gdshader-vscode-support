/**
 * GDShader 代码补全提供器
 * 使用 Analyzer 符号表进行上下文感知的自动补全.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  ALL_TYPES, ALL_KEYWORDS, BUILTIN_FUNCTIONS, BUILTIN_CONSTANTS,
  SHADER_TYPES, RENDER_MODES, PROCESSOR_FUNCTIONS,
  BUILTIN_VARS, SYNTAX_FOLLOW_RULES, UNIFORM_HINT_DETAILS,
  VECTOR_TYPES, MATRIX_TYPES,
} from '../data';
import { DocumentManager } from './document-manager';
import { SymbolKind, SymbolInfo } from '../parser/analyzer';
import { loc } from '../loc';

/** 可以接受 swizzle 的类型集合 (vec/mat 类型) */
const SWIZZLE_TYPES = new Set<string>([
  ...VECTOR_TYPES,
  ...MATRIX_TYPES,
]);

export class GDShaderCompletionProvider implements vscode.CompletionItemProvider {

  constructor(private docManager: DocumentManager) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    const uri = document.uri.toString();
    this.docManager.update(uri, document.getText());

    const lineText = document.lineAt(position.line).text;
    const linePrefix = lineText.substring(0, position.character);
    const items: vscode.CompletionItem[] = [];

    // #include 指令补全: 检测 #include 行
    const includePathMatch = linePrefix.match(/^#include\s+"([^"]*)$/);
    if (includePathMatch) {
      return this.getIncludePathCompletions(document, includePathMatch[1]);
    }

    // #gdshader-hint-redirection 路径补全
    const redirPathMatch = linePrefix.match(/#gdshader-hint-redirection\s*:\s*(\S*)$/);
    if (redirPathMatch) {
      return this.getIncludePathCompletions(document, redirPathMatch[1]);
    }

    // #gdshader-hint- 注释补全
    if (/\/\/\s*#gdshader-hint-\w*$/.test(linePrefix) || /\/\*\s*#gdshader-hint-\w*$/.test(linePrefix)) {
      return this.getHintCommentCompletions(linePrefix);
    }

    // #gdshader-hint-declare: 后续类型+名称补全 (兼容旧的 hint-def)
    if (/\/\/\s*#gdshader-hint-(?:declare|def)\s*:\s*\w*$/.test(linePrefix)) {
      return this.getHintDefTypeCompletions();
    }

    // # 前缀 -> 预处理器指令补全
    if (/^\s*#\w*$/.test(linePrefix)) {
      return this.getPreprocessorCompletions();
    }

    // "." 触发或 linePrefix 在 . 之后 -> dot 补全 (swizzle/struct 成员)
    // 检测: "identifier.", "identifier.partial", "func(args).", "type(args).", "a.member."
    if (context.triggerCharacter === '.' || /\.\w*$/.test(linePrefix)) {
      return this.getDotCompletions(document, position, linePrefix, uri);
    }

    // 使用通用后续语法规则进行上下文匹配
    for (const rule of SYNTAX_FOLLOW_RULES) {
      if (rule.triggerPattern.test(linePrefix)) {
        return this.getFollowItems(rule, uri);
      }
    }

    // 通用补全
    const shaderType = this.docManager.getShaderType(uri);
    const currentFunction = this.docManager.getProcessorFunctionAt(uri, position.line);

    // ── 从符号表获取所有可见符号 ──
    const visibleSymbols = this.docManager.getVisibleSymbols(uri, position.line);

    // 添加用户声明的变量/参数/uniform/varying/const
    for (const [name, sym] of visibleSymbols) {
      if (sym.kind === SymbolKind.BuiltinFunction || sym.kind === SymbolKind.BuiltinConstant || sym.kind === SymbolKind.BuiltinVar) {
        continue; // 内置符号下面单独添加 (更好的排序)
      }
      const item = this.symbolToCompletionItem(sym);
      if (item) {
        item.sortText = '1' + name; // 用户符号排在内置之前
        items.push(item);
      }
    }

    // 关键字
    for (const kw of ALL_KEYWORDS) {
      const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
      item.detail = loc('completion.keyword');
      item.sortText = '5' + kw;
      items.push(item);
    }

    // 类型
    for (const t of ALL_TYPES) {
      const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter);
      item.detail = loc('completion.type');
      item.sortText = '4' + t;
      items.push(item);
    }

    // 内置常量
    for (const c of BUILTIN_CONSTANTS) {
      const item = new vscode.CompletionItem(c, vscode.CompletionItemKind.Constant);
      item.detail = loc('completion.builtinConstant');
      item.sortText = '3' + c;
      items.push(item);
    }

    // 内置函数 (按上下文过滤)
    for (const fn of BUILTIN_FUNCTIONS) {
      if (fn.context && currentFunction && !fn.context.includes(currentFunction as any)) {
        continue;
      }
      const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
      item.detail = fn.signature;
      item.documentation = new vscode.MarkdownString(fn.description);
      item.sortText = '2' + fn.name;
      const params = this.extractParams(fn.signature);
      if (params.length > 0) {
        const snippetParams = params.map((p, i) => `\${${i + 1}:${p}}`).join(', ');
        item.insertText = new vscode.SnippetString(`${fn.name}(${snippetParams})`);
      } else {
        item.insertText = new vscode.SnippetString(`${fn.name}($0)`);
      }
      items.push(item);
    }

    // 内置变量 (按 AST 上下文过滤)
    const vars = BUILTIN_VARS[shaderType]?.[currentFunction];
    if (vars) {
      for (const v of vars) {
        const item = new vscode.CompletionItem(v.name, vscode.CompletionItemKind.Variable);
        item.detail = `${v.type} (${v.access})`;
        item.documentation = new vscode.MarkdownString(v.description);
        item.sortText = '0' + v.name; // 内置变量最高优先
        items.push(item);
      }
    }

    // Struct 类型名作为构造器
    const analysis = this.docManager.getAnalysis(uri);
    if (analysis) {
      for (const [name] of analysis.structs) {
        if (visibleSymbols.has(name)) continue; // 已添加
        const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Struct);
        item.detail = `struct ${name}`;
        item.sortText = '1' + name;
        items.push(item);
      }
    }

    // 处理器函数 snippet (带默认实现示例注释)
    const procFns = PROCESSOR_FUNCTIONS[shaderType as keyof typeof PROCESSOR_FUNCTIONS];
    if (procFns) {
      for (const fn of procFns) {
        const item = new vscode.CompletionItem(fn, vscode.CompletionItemKind.Function);
        item.detail = loc('completion.processorFunction', fn, shaderType);
        item.insertText = new vscode.SnippetString(this.processorSnippet(fn, shaderType));
        item.sortText = '6' + fn;
        items.push(item);
      }
    }

    return items;
  }

  /** 预处理器指令补全 (#include 等) */
  private getPreprocessorCompletions(): vscode.CompletionItem[] {
    const directives = [
      { name: '#include', detail: loc('completion.dir.include'), snippet: '#include "${1:path}"' },
      { name: '#define', detail: loc('completion.dir.define'), snippet: '#define ${1:NAME} ${2:value}' },
      { name: '#ifdef', detail: loc('completion.dir.ifdef'), snippet: '#ifdef ${1:NAME}' },
      { name: '#ifndef', detail: loc('completion.dir.ifndef'), snippet: '#ifndef ${1:NAME}' },
      { name: '#if', detail: loc('completion.dir.if'), snippet: '#if ${1:condition}' },
      { name: '#elif', detail: loc('completion.dir.elif'), snippet: '#elif ${1:condition}' },
      { name: '#else', detail: loc('completion.dir.else'), snippet: '#else' },
      { name: '#endif', detail: loc('completion.dir.endif'), snippet: '#endif' },
      { name: '#undef', detail: loc('completion.dir.undef'), snippet: '#undef ${1:NAME}' },
    ];
    return directives.map(d => {
      const item = new vscode.CompletionItem(d.name, vscode.CompletionItemKind.Keyword);
      item.detail = loc('completion.preprocessor', d.detail);
      item.insertText = new vscode.SnippetString(d.snippet);
      // 替换整个 #xxx 前缀
      item.filterText = d.name;
      return item;
    });
  }

  /** #include 路径补全: 列出当前目录下的 .gdshaderinc 文件 */
  private getIncludePathCompletions(document: vscode.TextDocument, currentPath: string): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    try {
      const docDir = path.dirname(document.uri.fsPath);
      // 如果 currentPath 有目录部分, 拼上
      const targetDir = currentPath.includes('/')
        ? path.resolve(docDir, path.dirname(currentPath))
        : docDir;
      if (!fs.existsSync(targetDir)) return items;
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const item = new vscode.CompletionItem(entry.name, vscode.CompletionItemKind.Folder);
          item.detail = loc('completion.folder');
          item.insertText = entry.name + '/';
          item.command = { command: 'editor.action.triggerSuggest', title: '' };
          items.push(item);
        } else if (entry.name.endsWith('.gdshaderinc') || entry.name.endsWith('.gdshader')) {
          const item = new vscode.CompletionItem(entry.name, vscode.CompletionItemKind.File);
          item.detail = entry.name.endsWith('.gdshaderinc') ? 'GDShader Include' : 'GDShader';
          item.insertText = entry.name;
          items.push(item);
        }
      }
    } catch {
      // 忽略文件系统错误
    }
    return items;
  }

  /** #gdshader-hint-* 注释关键字补全 */
  private getHintCommentCompletions(linePrefix: string): vscode.CompletionItem[] {
    const hints = [
      { label: '#gdshader-hint-ignore', detail: loc('completion.hint.ignore'), snippet: '#gdshader-hint-ignore' },
      { label: '#gdshader-hint-declare:', detail: loc('completion.hint.declare'), snippet: '#gdshader-hint-declare:${1:type} ${2:name}' },
      { label: '#gdshader-hint-type:', detail: loc('completion.hint.type'), snippet: '#gdshader-hint-type:${1:type}' },
      { label: '#gdshader-hint-redirection:', detail: loc('completion.hint.redirection'), snippet: '#gdshader-hint-redirection:${1:./path}' },
    ];
    return hints.map(h => {
      const item = new vscode.CompletionItem(h.label, vscode.CompletionItemKind.Snippet);
      item.detail = h.detail;
      item.insertText = new vscode.SnippetString(h.snippet);
      item.filterText = h.label;
      // 设置替换范围: 从 #gdshader-hint- 开始
      item.sortText = '0' + h.label;
      return item;
    });
  }

  /** #gdshader-hint-def: 后的类型名补全 */
  private getHintDefTypeCompletions(): vscode.CompletionItem[] {
    return ALL_TYPES.filter(t => t !== 'void').map(t => {
      const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter);
      item.detail = loc('completion.type.forHint');
      // 插入 "type name" snippet
      item.insertText = new vscode.SnippetString(`${t} \${1:name}`);
      return item;
    });
  }

  /** "." 后补全: swizzle + struct 成员 (仅对适用的类型) */
  private getDotCompletions(
    _document: vscode.TextDocument,
    position: vscode.Position,
    linePrefix: string,
    uri: string
  ): vscode.CompletionItem[] {
    // 推导 "." 前面表达式的类型
    const typeName = this.inferDotPrefixType(linePrefix, uri, position.line);
    if (!typeName) return [];

    return this.completionsForType(typeName, uri);
  }

  /** 根据类型名生成 dot 补全项 (struct 成员 / swizzle / length) */
  private completionsForType(typeName: string, uri: string): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // struct 成员
    const members = this.docManager.getStructMembers(uri, typeName);
    if (members.length > 0) {
      for (const m of members) {
        const item = new vscode.CompletionItem(m.name, vscode.CompletionItemKind.Field);
        item.detail = `${m.typeName}${m.isArray ? '[]' : ''}`;
        item.sortText = '0' + m.name;
        items.push(item);
      }
      return items;
    }

    // swizzle (vec/mat 类型)
    if (SWIZZLE_TYPES.has(typeName)) {
      items.push(
        ...this.createSwizzleItems(['x', 'y', 'z', 'w']),
        ...this.createSwizzleItems(['r', 'g', 'b', 'a']),
        ...this.createSwizzleItems(['s', 't', 'p', 'q']),
      );
    }

    return items;
  }

  /**
   * 推导 linePrefix 中 "." 之前表达式的类型.
   * 支持: 简单标识符、类型构造器 vec4(...)、函数调用 func(...)、链式成员 a.member, func().member
   */
  private inferDotPrefixType(linePrefix: string, uri: string, line: number): string | null {
    // 找最后一个不在括号内的 "."
    const dotIdx = this.findLastDotOutsideParens(linePrefix);
    if (dotIdx < 0) return null;
    const beforeDot = linePrefix.substring(0, dotIdx);

    // 提取末尾标识符 (如果有)
    const simpleMatch = beforeDot.match(/([a-zA-Z_]\w*)$/);

    // Case 1: 末尾是 ")" → func(...) 调用表达式
    const callType = this.inferCallExprType(beforeDot, uri, line);
    if (callType) return callType;

    // Case 2: 末尾是简单标识符 (非跟在 "." 后面) → 查符号表
    if (simpleMatch) {
      const tail = simpleMatch[1];
      const tailStart = beforeDot.length - tail.length;
      const charBefore = tailStart > 0 ? beforeDot[tailStart - 1] : '';

      if (charBefore !== '.') {
        // 普通标识符: 查符号表
        const sym = this.docManager.resolveSymbol(uri, tail, line);
        if (sym) return sym.typeName;
        if (ALL_TYPES.includes(tail)) return tail;
        return null;
      }

      // Case 3: "...something.member" → 链式成员访问, 递归
      // charBefore === '.', 说明 tail 是上一级表达式的成员名
      const parentPrefix = beforeDot.substring(0, tailStart); // 包含末尾的 "."
      const parentType = this.inferDotPrefixType(parentPrefix, uri, line);
      if (parentType) {
        return this.inferMemberType(parentType, tail, uri);
      }
    }

    return null;
  }

  /**
   * 从右向左查找最后一个不在括号 () 内部的 "." 的索引.
   * 跳过嵌套在函数调用参数中的 "." (如 0.149).
   */
  private findLastDotOutsideParens(s: string): number {
    let depth = 0;
    for (let i = s.length - 1; i >= 0; i--) {
      const ch = s[i];
      if (ch === ')') depth++;
      else if (ch === '(') depth--;
      else if (ch === '.' && depth === 0) return i;
    }
    return -1;
  }

  /** 回溯括号, 推导函数/构造器调用表达式的返回类型 */
  private inferCallExprType(beforeDot: string, uri: string, line: number): string | null {
    // beforeDot 的末尾应该是 ")"
    const trimmed = beforeDot.trimEnd();
    if (!trimmed.endsWith(')')) return null;

    // 从末尾的 ")" 回溯匹配 "("
    let depth = 0;
    let i = trimmed.length - 1;
    for (; i >= 0; i--) {
      if (trimmed[i] === ')') depth++;
      else if (trimmed[i] === '(') { depth--; if (depth === 0) break; }
    }
    if (i < 0) return null;

    // i 现在指向 "(", 提取它前面的标识符
    const beforeParen = trimmed.substring(0, i);
    const nameMatch = beforeParen.match(/([a-zA-Z_]\w*)$/);
    if (!nameMatch) return null;
    const calleeName = nameMatch[1];

    // 类型构造器: vec4(...), mat3(...), float(...) 等
    if (ALL_TYPES.includes(calleeName)) return calleeName;

    // struct 构造器
    const analysis = this.docManager.getAnalysis(uri);
    if (analysis?.structs.has(calleeName)) return calleeName;

    // 用户函数: 查符号表获取返回类型
    const sym = this.docManager.resolveSymbol(uri, calleeName, line);
    if (sym && (sym.kind === SymbolKind.Function || sym.kind === SymbolKind.BuiltinFunction || sym.kind === SymbolKind.HintDefined)) {
      return sym.typeName;
    }

    return null;
  }

  /** 推导成员访问的结果类型 */
  private inferMemberType(parentType: string, memberName: string, uri: string): string | null {
    // struct 成员
    const members = this.docManager.getStructMembers(uri, parentType);
    if (members.length > 0) {
      const m = members.find(m => m.name === memberName);
      return m ? m.typeName : null;
    }

    // swizzle: 根据分量数推导结果类型
    if (SWIZZLE_TYPES.has(parentType)) {
      const swizzleLen = memberName.length;
      if (swizzleLen >= 1 && swizzleLen <= 4 && /^[xyzwrgbastpq]+$/.test(memberName)) {
        // 从 parentType 中提取基础类型前缀 (vec -> vec, ivec -> ivec, bvec -> bvec, uvec -> uvec)
        const baseMatch = parentType.match(/^(b?vec|[iu]?vec|mat)/);
        if (baseMatch) {
          const base = parentType.replace(/\d+$/, ''); // vec4 -> vec, ivec3 -> ivec
          if (swizzleLen === 1) {
            // 单分量: vec4.x -> float, ivec3.x -> int
            if (base === 'vec') return 'float';
            if (base === 'ivec') return 'int';
            if (base === 'uvec') return 'uint';
            if (base === 'bvec') return 'bool';
          }
          return `${base}${swizzleLen}`;
        }
      }
    }

    return null;
  }

  /** 将符号转为补全项 */
  private symbolToCompletionItem(sym: SymbolInfo): vscode.CompletionItem | null {
    switch (sym.kind) {
      case SymbolKind.Variable:
      case SymbolKind.Constant: {
        const item = new vscode.CompletionItem(sym.name, sym.isConst
          ? vscode.CompletionItemKind.Constant
          : vscode.CompletionItemKind.Variable
        );
        item.detail = `${sym.isConst ? 'const ' : ''}${sym.typeName} ${sym.name}`;
        return item;
      }
      case SymbolKind.Parameter: {
        const item = new vscode.CompletionItem(sym.name, vscode.CompletionItemKind.Variable);
        item.detail = `${sym.typeName} ${sym.name} (${loc('completion.parameter')})`;
        return item;
      }
      case SymbolKind.Uniform: {
        const item = new vscode.CompletionItem(sym.name, vscode.CompletionItemKind.Property);
        item.detail = `uniform ${sym.typeName} ${sym.name}`;
        return item;
      }
      case SymbolKind.Varying: {
        const item = new vscode.CompletionItem(sym.name, vscode.CompletionItemKind.Property);
        item.detail = `varying ${sym.typeName} ${sym.name}`;
        return item;
      }
      case SymbolKind.Function: {
        const item = new vscode.CompletionItem(sym.name, vscode.CompletionItemKind.Function);
        item.detail = sym.signature ?? `${sym.typeName} ${sym.name}(...)`;
        if (sym.parameters && sym.parameters.length > 0) {
          const snippetParams = sym.parameters.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ');
          item.insertText = new vscode.SnippetString(`${sym.name}(${snippetParams})`);
        } else {
          item.insertText = new vscode.SnippetString(`${sym.name}($0)`);
        }
        return item;
      }
      case SymbolKind.Struct: {
        const item = new vscode.CompletionItem(sym.name, vscode.CompletionItemKind.Struct);
        item.detail = `struct ${sym.name}`;
        return item;
      }
      case SymbolKind.HintDefined: {
        if (sym.signature) {
          const item = new vscode.CompletionItem(sym.name, vscode.CompletionItemKind.Function);
          item.detail = sym.signature;
          item.documentation = new vscode.MarkdownString(loc('completion.hintDeclare.via'));
          if (sym.parameters && sym.parameters.length > 0) {
            const snippetParams = sym.parameters.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ');
            item.insertText = new vscode.SnippetString(`${sym.name}(${snippetParams})`);
          } else {
            item.insertText = new vscode.SnippetString(`${sym.name}($0)`);
          }
          return item;
        } else {
          const item = new vscode.CompletionItem(sym.name, vscode.CompletionItemKind.Variable);
          item.detail = loc('completion.hintDeclare.detail', sym.typeName, sym.name);
          return item;
        }
      }
      default:
        return null;
    }
  }

  /** 根据后续语法规则获取补全项 */
  private getFollowItems(
    rule: typeof SYNTAX_FOLLOW_RULES[number],
    uri: string,
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    const shaderType = this.docManager.getShaderType(uri);

    switch (rule.followKind) {
      case 'shader_type':
        for (const st of SHADER_TYPES) {
          const item = new vscode.CompletionItem(st, vscode.CompletionItemKind.EnumMember);
          item.detail = loc('completion.shaderType', st);
          items.push(item);
        }
        break;
      case 'render_mode': {
        const modes = RENDER_MODES[shaderType] || [];
        for (const mode of modes) {
          const item = new vscode.CompletionItem(mode, vscode.CompletionItemKind.EnumMember);
          item.detail = loc('completion.renderMode', shaderType);
          items.push(item);
        }
        break;
      }
      case 'uniform_hint':
        for (const hint of UNIFORM_HINT_DETAILS) {
          const item = new vscode.CompletionItem(hint.name, vscode.CompletionItemKind.Property);
          item.detail = loc('completion.uniformHint', hint.applicableTypes.join(', '));
          item.documentation = new vscode.MarkdownString(hint.description);
          items.push(item);
        }
        break;
      case 'type':
        for (const t of ALL_TYPES) {
          const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.TypeParameter);
          item.detail = loc('completion.type');
          items.push(item);
        }
        // 也加入用户定义的 struct 类型
        const analysis = this.docManager.getAnalysis(uri);
        if (analysis) {
          for (const [name] of analysis.structs) {
            const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Struct);
            item.detail = `struct ${name}`;
            items.push(item);
          }
        }
        break;
    }
    return items;
  }

  private createSwizzleItems(components: string[]): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    for (const c of components) {
      items.push(new vscode.CompletionItem(c, vscode.CompletionItemKind.Field));
    }
    if (components.length >= 2) items.push(new vscode.CompletionItem(components.slice(0, 2).join(''), vscode.CompletionItemKind.Field));
    if (components.length >= 3) items.push(new vscode.CompletionItem(components.slice(0, 3).join(''), vscode.CompletionItemKind.Field));
    if (components.length >= 4) items.push(new vscode.CompletionItem(components.slice(0, 4).join(''), vscode.CompletionItemKind.Field));
    return items;
  }

  private extractParams(signature: string): string[] {
    const match = signature.match(/\(([^)]*)\)/);
    if (!match) return [];
    return match[1].split(',').map(p => p.trim().split(/\s+/).pop() || '').filter(Boolean);
  }

  /** 生成处理器函数 snippet, 包含默认实现示例注释 */
  private processorSnippet(fn: string, shaderType: string): string {
    const examples: Record<string, Record<string, string>> = {
      spatial: {
        vertex: 'void vertex() {\n\t// VERTEX.y += sin(TIME) * 0.1;\n\t// UV = UV * 2.0;\n\t$0\n}',
        fragment: 'void fragment() {\n\t// ALBEDO = vec3(1.0);\n\t// ROUGHNESS = 0.5;\n\t// METALLIC = 0.0;\n\t$0\n}',
        light: 'void light() {\n\t// float NdotL = max(dot(NORMAL, LIGHT), 0.0);\n\t// DIFFUSE_LIGHT += LIGHT_COLOR * NdotL * ATTENUATION;\n\t$0\n}',
      },
      canvas_item: {
        vertex: 'void vertex() {\n\t// VERTEX += vec2(sin(TIME), 0.0);\n\t$0\n}',
        fragment: 'void fragment() {\n\t// vec4 tex = texture(TEXTURE, UV);\n\t// COLOR = tex;\n\t$0\n}',
        light: 'void light() {\n\t// LIGHT = vec4(LIGHT_COLOR.rgb * LIGHT_ENERGY, 1.0);\n\t$0\n}',
      },
      particles: {
        start: 'void start() {\n\t// VELOCITY = vec3(0.0, 1.0, 0.0);\n\t// COLOR = vec4(1.0);\n\t$0\n}',
        process: 'void process() {\n\t// VELOCITY.y -= 9.8 * DELTA;\n\t// COLOR.a -= DELTA / LIFETIME;\n\t$0\n}',
      },
      sky: {
        sky: 'void sky() {\n\t// COLOR = mix(vec3(0.1), vec3(0.3, 0.5, 1.0), clamp(EYEDIR.y, 0.0, 1.0));\n\t$0\n}',
      },
      fog: {
        fog: 'void fog() {\n\t// DENSITY = 1.0;\n\t// ALBEDO = vec3(0.8);\n\t// EMISSION = vec3(0.0);\n\t$0\n}',
      },
    };
    return examples[shaderType]?.[fn] ?? `void ${fn}() {\n\t$0\n}`;
  }
}
