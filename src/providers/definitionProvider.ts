/**
 * GDShader 跳转到定义提供器
 * 使用 Analyzer 符号表定位符号的声明位置.
 * 支持: 变量/函数/struct 跳转, struct 字段跳转, #include 路径跳转, 跨文件跳转.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentManager } from './document-manager';
import { SymbolKind } from '../parser/analyzer';

export class GDShaderDefinitionProvider implements vscode.DefinitionProvider {

  constructor(private docManager: DocumentManager) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Definition | null {
    const uri = document.uri.toString();
    const info = this.docManager.getOrUpdate(uri, document.getText());

    // ── #include 路径跳转 ──
    const lineText = document.lineAt(position.line).text;
    const includeMatch = lineText.match(/^#include\s+"([^"]+)"/);
    if (includeMatch) {
      const incPath = includeMatch[1];
      const docDir = path.dirname(document.uri.fsPath);
      // 检查是否有 redirection
      const inc = info.analysis.hints?.includes.find(i => i.line === position.line);
      let targetPath: string | null = null;
      if (inc?.redirectPath) {
        // 有 redirection 时优先使用 (适用于所有 include 类型)
        targetPath = path.resolve(docDir, inc.redirectPath);
      } else if (!inc?.isResPath) {
        targetPath = path.resolve(docDir, incPath);
      }
      if (targetPath && fs.existsSync(targetPath)) {
        return new vscode.Location(vscode.Uri.file(targetPath), new vscode.Position(0, 0));
      }
      return null;
    }

    // ── 符号跳转 ──
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
    if (!wordRange) return null;
    const word = document.getText(wordRange);

    // 检查是否在 dot 表达式中 (a.member → 跳转到 struct 字段定义)
    const linePrefix = lineText.substring(0, wordRange.start.character);
    const dotMatch = linePrefix.match(/([a-zA-Z_]\w*)\.$/);
    if (dotMatch) {
      return this.resolveStructMemberDef(uri, document, dotMatch[1], word, position.line);
    }

    const sym = this.docManager.resolveSymbol(uri, word, position.line);
    if (!sym) return null;

    // 内置符号没有声明位置
    if (sym.kind === SymbolKind.BuiltinVar ||
        sym.kind === SymbolKind.BuiltinFunction ||
        sym.kind === SymbolKind.BuiltinConstant) {
      return null;
    }

    if (sym.declLine === undefined || sym.declColumn === undefined) return null;

    const targetUri = sym.sourceUri
      ? vscode.Uri.parse(sym.sourceUri)
      : document.uri;

    return new vscode.Location(
      targetUri,
      new vscode.Position(sym.declLine, sym.declColumn)
    );
  }

  /** 解析 struct 字段定义跳转: obj.field → struct 的 field 声明位置 */
  private resolveStructMemberDef(
    uri: string,
    document: vscode.TextDocument,
    objName: string,
    memberName: string,
    line: number,
  ): vscode.Location | null {
    // 查找 obj 的类型
    const sym = this.docManager.resolveSymbol(uri, objName, line);
    if (!sym) return null;
    const structName = sym.typeName;

    // 查找 struct 成员
    const members = this.docManager.getStructMembers(uri, structName);
    const member = members.find(m => m.name === memberName);
    if (!member || member.declLine === undefined || member.declColumn === undefined) return null;

    const targetUri = member.sourceUri
      ? vscode.Uri.parse(member.sourceUri)
      : document.uri;

    return new vscode.Location(
      targetUri,
      new vscode.Position(member.declLine, member.declColumn)
    );
  }
}
