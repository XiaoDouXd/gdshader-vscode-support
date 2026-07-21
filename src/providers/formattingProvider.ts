/**
 * GDShader 文档格式化提供器 (VS Code 接口层).
 * 核心缩进逻辑见 formattingProvider-core.ts.
 */
import * as vscode from 'vscode';
import { computeFormatEdits } from './formattingProvider-core';

export { computeFormatEdits, FormatEdit } from './formattingProvider-core';

export class GDShaderDocumentFormattingProvider implements vscode.DocumentFormattingEditProvider {

  provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    _token: vscode.CancellationToken,
  ): vscode.TextEdit[] {
    const source = document.getText();
    const lines: string[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      lines.push(document.lineAt(i).text);
    }
    const edits = computeFormatEdits(source, lines, options.insertSpaces, options.tabSize);
    return edits.map(e => vscode.TextEdit.replace(document.lineAt(e.line).range, e.text));
  }
}
