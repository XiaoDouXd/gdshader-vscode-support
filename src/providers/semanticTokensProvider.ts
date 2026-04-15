/**
 * GDShader 语义高亮提供器
 * 为 struct 类型名在使用处提供类型颜色高亮.
 */
import * as vscode from 'vscode';
import { DocumentManager } from './document-manager';

const TOKEN_TYPES = ['type'] as const;
const TOKEN_MODIFIERS: string[] = [];

export const SEMANTIC_TOKENS_LEGEND = new vscode.SemanticTokensLegend(
  [...TOKEN_TYPES],
  TOKEN_MODIFIERS
);

export class GDShaderSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {

  constructor(private docManager: DocumentManager) {}

  provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.SemanticTokens {
    const uri = document.uri.toString();
    const info = this.docManager.getOrUpdate(uri, document.getText());
    const builder = new vscode.SemanticTokensBuilder(SEMANTIC_TOKENS_LEGEND);

    const structNames = new Set<string>(info.analysis.structs.keys());
    if (structNames.size === 0) return builder.build();

    // 逐行扫描, 跳过注释和 struct 定义行中的名称
    for (let line = 0; line < document.lineCount; line++) {
      const lineText = document.lineAt(line).text;

      // 跳过注释行
      const trimmed = lineText.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

      // 从行内去掉注释部分
      const codePart = lineText.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');

      // 用正则匹配所有标识符
      const identPattern = /\b([a-zA-Z_]\w*)\b/g;
      let match;
      while ((match = identPattern.exec(codePart)) !== null) {
        const name = match[1];
        if (!structNames.has(name)) continue;

        const col = match.index;

        // 跳过 struct 定义行中紧跟 "struct " 关键字后的名称 (TMLanguage 已处理)
        const beforeIdent = codePart.substring(0, col);
        if (/\bstruct\s+$/.test(beforeIdent)) continue;

        builder.push(line, col, name.length, 0 /* type */);
      }
    }

    return builder.build();
  }
}
