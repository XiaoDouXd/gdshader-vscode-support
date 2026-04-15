/**
 * GDShader 文档格式化提供器
 * 处理缩进规范化和一致的代码间距.
 */
import * as vscode from 'vscode';

export class GDShaderDocumentFormattingProvider implements vscode.DocumentFormattingEditProvider {

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    _token: vscode.CancellationToken
  ): vscode.TextEdit[] {
    const edits: vscode.TextEdit[] = [];
    const tabChar = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';

    let indentLevel = 0;
    let inBlockComment = false;

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const trimmed = line.text.trim();

      // 处理块注释
      if (inBlockComment) {
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
        continue;
      }

      if (trimmed.startsWith('/*')) {
        if (!trimmed.includes('*/')) {
          inBlockComment = true;
        }
        continue;
      }

      // 跳过空行
      if (trimmed.length === 0) continue;

      // "} else {" 或 "} else if (...) {": 先减后增, 净变化为 0
      if (trimmed.startsWith('}') && trimmed.endsWith('{')) {
        indentLevel = Math.max(0, indentLevel - 1);
        const expectedIndent = tabChar.repeat(indentLevel);
        const expectedLine = expectedIndent + trimmed;
        if (line.text !== expectedLine) {
          edits.push(vscode.TextEdit.replace(line.range, expectedLine));
        }
        indentLevel++;
        continue;
      }

      // 遇到右大括号时减少缩进
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // 计算期望的缩进
      const expectedIndent = tabChar.repeat(indentLevel);
      const expectedLine = expectedIndent + trimmed;

      // 仅当内容不同时才创建编辑
      if (line.text !== expectedLine) {
        edits.push(vscode.TextEdit.replace(line.range, expectedLine));
      }

      // 遇到左大括号时增加缩进
      if (trimmed.endsWith('{')) {
        indentLevel++;
      }
    }

    return edits;
  }
}
