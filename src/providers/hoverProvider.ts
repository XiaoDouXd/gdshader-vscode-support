/**
 * GDShader 悬停提示提供器
 * 使用 Analyzer 符号表进行精确的上下文检测和类型提示.
 */
import * as vscode from 'vscode';
import {
  ALL_TYPES, ALL_KEYWORDS,
  BUILTIN_VARS, UNIFORM_HINTS, CONSTANT_VALUES, UNIFORM_HINT_DETAILS,
} from '../data';
import { DocumentManager } from './document-manager';
import { SymbolKind, SymbolInfo } from '../parser/analyzer';
import { loc } from '../loc';

export class GDShaderHoverProvider implements vscode.HoverProvider {

  constructor(private docManager: DocumentManager) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Hover | null {
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
    if (!wordRange) return null;

    const word = document.getText(wordRange);
    const uri = document.uri.toString();
    this.docManager.getOrUpdate(uri, document.getText());

    // 0. 检查是否在 dot 表达式中 → struct 字段 hover
    const lineText = document.lineAt(position.line).text;
    const linePrefix = lineText.substring(0, wordRange.start.character);
    const dotMatch = linePrefix.match(/([a-zA-Z_]\w*)\.$/);
    if (dotMatch) {
      const hover = this.hoverForStructMember(uri, dotMatch[1], word, position.line);
      if (hover) return new vscode.Hover(hover, wordRange);
    }

    // 1. 符号表查找
    const sym = this.docManager.resolveSymbol(uri, word, position.line);
    if (sym) {
      const hover = this.hoverForSymbol(sym, document);
      if (hover) return new vscode.Hover(hover, wordRange);
    }

    // 2. 类型
    if (ALL_TYPES.includes(word)) {
      return new vscode.Hover(new vscode.MarkdownString(loc('hover.type', word)), wordRange);
    }

    // 3. 关键字
    if (ALL_KEYWORDS.includes(word)) {
      return new vscode.Hover(new vscode.MarkdownString(loc('hover.keyword', word)), wordRange);
    }

    // 4. Uniform 提示
    if ((UNIFORM_HINTS as readonly string[]).includes(word)) {
      const detail = UNIFORM_HINT_DETAILS.find(h => h.name === word);
      const desc = detail ? `\n\n${detail.description}\n\n${loc('hover.uniformHint.applicableTypes', detail.applicableTypes.join(', '))}` : '';
      return new vscode.Hover(
        new vscode.MarkdownString(`${loc('hover.uniformHint', word)}${desc}`),
        wordRange
      );
    }

    // 5. 跨上下文的内置变量提示
    const shaderType = this.docManager.getShaderType(uri);
    const currentFn = this.docManager.getProcessorFunctionAt(uri, position.line);
    const allVars = BUILTIN_VARS[shaderType];
    if (allVars) {
      for (const [fnName, fnVars] of Object.entries(allVars)) {
        if (fnName === currentFn) continue;
        const v = fnVars.find(bv => bv.name === word);
        if (v) {
          const md = new vscode.MarkdownString();
          md.appendCodeblock(`${v.type} ${v.name}  // ${v.access}`, 'gdshader');
          md.appendMarkdown(`\n\n${v.description}`);
          md.appendMarkdown(`\n\n${loc('hover.builtinVar.notAvailable', fnName)}`);
          return new vscode.Hover(md, wordRange);
        }
      }
    }

    return null;
  }

  /** struct 成员的 hover: obj.field → 显示 field 类型和注释 */
  private hoverForStructMember(uri: string, objName: string, memberName: string, line: number): vscode.MarkdownString | null {
    const sym = this.docManager.resolveSymbol(uri, objName, line);
    if (!sym) return null;
    const members = this.docManager.getStructMembers(uri, sym.typeName);
    const member = members.find(m => m.name === memberName);
    if (!member) return null;

    const md = new vscode.MarkdownString();
    md.appendCodeblock(`${member.typeName} ${sym.typeName}.${member.name}${member.isArray ? '[]' : ''}`, 'gdshader');
    if (member.comment) {
      md.appendMarkdown(`\n\n${member.comment}`);
    }
    if (member.declLine !== undefined) {
      md.appendMarkdown(`\n\n${loc('hover.structMember.declaredAt', sym.typeName, member.declLine + 1)}`);
    }
    return md;
  }

  /** 根据符号信息生成 Hover 内容 */
  private hoverForSymbol(sym: SymbolInfo, document: vscode.TextDocument): vscode.MarkdownString | null {
    const md = new vscode.MarkdownString();

    switch (sym.kind) {
      case SymbolKind.Variable:
      case SymbolKind.Constant: {
        const prefix = sym.isConst ? 'const ' : '';
        md.appendCodeblock(`${prefix}${sym.typeName} ${sym.name}`, 'gdshader');
        if (sym.declLine !== undefined) {
          md.appendMarkdown(`\n\n${loc('hover.declaredAtLine', sym.declLine + 1)}`);
          const comment = this.extractTrailingComment(document, sym.declLine);
          if (comment) md.appendMarkdown(`\n\n${comment}`);
        }
        break;
      }
      case SymbolKind.Parameter: {
        md.appendCodeblock(`${sym.typeName} ${sym.name}  // ${loc('hover.parameter')}`, 'gdshader');
        if (sym.declLine !== undefined) {
          md.appendMarkdown(`\n\n${loc('hover.parameter.declaredAt', sym.declLine + 1)}`);
        }
        break;
      }
      case SymbolKind.Uniform: {
        md.appendCodeblock(`uniform ${sym.typeName} ${sym.name}`, 'gdshader');
        if (sym.declLine !== undefined) {
          md.appendMarkdown(`\n\n${loc('hover.uniform.declaredAt', sym.declLine + 1)}`);
          const comment = this.extractTrailingComment(document, sym.declLine);
          if (comment) md.appendMarkdown(`\n\n${comment}`);
        }
        break;
      }
      case SymbolKind.Varying: {
        md.appendCodeblock(`varying ${sym.typeName} ${sym.name}`, 'gdshader');
        if (sym.declLine !== undefined) {
          md.appendMarkdown(`\n\n${loc('hover.varying.declaredAt', sym.declLine + 1)}`);
          const comment = this.extractTrailingComment(document, sym.declLine);
          if (comment) md.appendMarkdown(`\n\n${comment}`);
        }
        break;
      }
      case SymbolKind.Function: {
        md.appendCodeblock(sym.signature ?? `${sym.typeName} ${sym.name}(...)`, 'gdshader');
        if (sym.description) {
          md.appendMarkdown(`\n\n${sym.description}`);
        }
        if (sym.declLine !== undefined) {
          md.appendMarkdown(`\n\n${loc('hover.userFunction.declaredAt', sym.declLine + 1)}`);
          if (!sym.description) {
            const docComment = this.extractDocComment(document, sym.declLine);
            if (docComment) md.appendMarkdown(`\n\n${docComment}`);
          }
        }
        break;
      }
      case SymbolKind.Struct: {
        md.appendCodeblock(`struct ${sym.name}`, 'gdshader');
        if (sym.members && sym.members.length > 0) {
          const memberList = sym.members.map(m => {
            const commentPart = m.comment ? `  // ${m.comment}` : '';
            return `  ${m.typeName} ${m.name}${m.isArray ? '[]' : ''};${commentPart}`;
          }).join('\n');
          md.appendCodeblock(`struct ${sym.name} {\n${memberList}\n}`, 'gdshader');
        }
        if (sym.declLine !== undefined) {
          md.appendMarkdown(`\n\n${loc('hover.declaredAtLine', sym.declLine + 1)}`);
        }
        break;
      }
      case SymbolKind.BuiltinVar: {
        md.appendCodeblock(`${sym.typeName} ${sym.name}  // ${sym.access}`, 'gdshader');
        if (sym.description) md.appendMarkdown(`\n\n${sym.description}`);
        break;
      }
      case SymbolKind.BuiltinFunction: {
        md.appendCodeblock(sym.signature ?? sym.name, 'gdshader');
        if (sym.description) md.appendMarkdown(`\n\n${sym.description}`);
        break;
      }
      case SymbolKind.BuiltinConstant: {
        md.appendMarkdown(loc('hover.constant', sym.name, CONSTANT_VALUES[sym.name] ?? ''));
        break;
      }
      case SymbolKind.HintDefined: {
        if (sym.signature) {
          md.appendCodeblock(sym.signature, 'gdshader');
        } else {
          md.appendCodeblock(`${sym.typeName} ${sym.name}`, 'gdshader');
        }
        md.appendMarkdown(`\n\n${loc('hover.hintDeclare')}`);
        break;
      }
      default:
        return null;
    }

    return md;
  }

  /** 从指定行提取尾部行注释, 移除 #gdshader-hint-* 标签 */
  private extractTrailingComment(document: vscode.TextDocument, line: number): string | null {
    if (line < 0 || line >= document.lineCount) return null;
    const lineText = document.lineAt(line).text;
    const commentMatch = lineText.match(/\/\/(.*)$/);
    if (!commentMatch) return null;
    let comment = commentMatch[1].trim();
    comment = comment.replace(/#gdshader-hint-\S*/g, '').trim();
    if (!comment) return null;
    return comment;
  }

  /**
   * 提取函数声明之前的 /// 文档注释块.
   * 形如:
   *   /// summary text
   *   /// @param x description
   *   /// @return description
   */
  private extractDocComment(document: vscode.TextDocument, declLine: number): string | null {
    const lines: string[] = [];
    let i = declLine - 1;
    while (i >= 0) {
      const text = document.lineAt(i).text.trim();
      const tripleMatch = text.match(/^\/\/\/\s?(.*)/);
      if (tripleMatch) {
        lines.unshift(tripleMatch[1]);
        i--;
      } else {
        break;
      }
    }
    if (lines.length === 0) return null;

    // 格式化: @param → **@param**, @return → **@return**
    const formatted = lines.map(l => {
      return l
        .replace(/@param\s+(\w+)/, '**@param** `$1`')
        .replace(/@return\b/, '**@return**');
    });
    return formatted.join('  \n');
  }
}
