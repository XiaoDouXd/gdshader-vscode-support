/**
 * GDShader 重命名符号提供器
 * 支持同文件内的符号重命名. 跨文件定义 (来自 #include) 禁止重命名.
 */
import * as vscode from 'vscode';
import { DocumentManager } from './document-manager';
import { SymbolKind, SymbolInfo } from '../parser/analyzer';
import { NodeKind } from '../parser/ast';
import { loc } from '../loc';
import type {
  ShaderFileNode, FunctionDeclNode, BlockStmtNode,
  Statement, Expression, TopLevelDecl,
} from '../parser/ast';

export class GDShaderRenameProvider implements vscode.RenameProvider {

  constructor(private docManager: DocumentManager) {}

  prepareRename(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.Range | { range: vscode.Range; placeholder: string } | null {
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
    if (!wordRange) return null;

    const word = document.getText(wordRange);
    const uri = document.uri.toString();
    this.docManager.getOrUpdate(uri, document.getText());

    const sym = this.docManager.resolveSymbol(uri, word, position.line);
    if (!sym) return null;

    // 内置符号不可重命名
    if (sym.kind === SymbolKind.BuiltinVar ||
        sym.kind === SymbolKind.BuiltinFunction ||
        sym.kind === SymbolKind.BuiltinConstant) {
      throw new Error(loc('rename.builtinNotAllowed'));
    }

    // HintDefined 符号不可重命名
    if (sym.kind === SymbolKind.HintDefined) {
      throw new Error(loc('rename.hintDeclareNotAllowed'));
    }

    // 来自 include 文件的符号不可重命名
    if (sym.sourceUri) {
      throw new Error(loc('rename.crossFileNotAllowed'));
    }

    return { range: wordRange, placeholder: word };
  }

  provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string,
    _token: vscode.CancellationToken
  ): vscode.WorkspaceEdit | null {
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
    if (!wordRange) return null;

    const word = document.getText(wordRange);
    const uri = document.uri.toString();
    const info = this.docManager.getOrUpdate(uri, document.getText());

    const sym = this.docManager.resolveSymbol(uri, word, position.line);
    if (!sym) return null;

    // 安全检查: 再次验证不是跨文件符号
    if (sym.sourceUri ||
        sym.kind === SymbolKind.BuiltinVar ||
        sym.kind === SymbolKind.BuiltinFunction ||
        sym.kind === SymbolKind.BuiltinConstant ||
        sym.kind === SymbolKind.HintDefined) {
      return null;
    }

    // 收集所有引用位置
    const locations = this.findAllReferences(info.result.ast, sym);

    if (locations.length === 0) return null;

    const edit = new vscode.WorkspaceEdit();
    for (const loc of locations) {
      edit.replace(
        document.uri,
        new vscode.Range(loc.line, loc.column, loc.line, loc.column + loc.length),
        newName
      );
    }

    return edit;
  }

  /** 在 AST 中查找符号的所有出现位置 (声明 + 引用) */
  private findAllReferences(
    ast: ShaderFileNode,
    targetSym: SymbolInfo,
  ): { line: number; column: number; length: number }[] {
    const refs: { line: number; column: number; length: number }[] = [];
    const targetName = targetSym.name;

    // 添加声明位置
    if (targetSym.declLine !== undefined && targetSym.declColumn !== undefined) {
      refs.push({ line: targetSym.declLine, column: targetSym.declColumn, length: targetName.length });
    }

    // 遍历 AST 查找所有引用
    for (const decl of ast.declarations) {
      this.collectRefsInTopLevel(decl, targetName, refs);
    }

    // 去重 (声明位置可能被遍历两次)
    return this.dedupRefs(refs);
  }

  private collectRefsInTopLevel(decl: TopLevelDecl, name: string, refs: { line: number; column: number; length: number }[]): void {
    switch (decl.kind) {
      case NodeKind.FunctionDecl: {
        const fn = decl as FunctionDeclNode;
        // 函数名引用
        if (fn.name.value === name) {
          refs.push({ line: fn.name.line, column: fn.name.column, length: fn.name.length });
        }
        // 参数中的引用
        for (const p of fn.parameters) {
          if (p.name.value === name) {
            refs.push({ line: p.name.line, column: p.name.column, length: p.name.length });
          }
        }
        // 函数体
        if (fn.body) this.collectRefsInBlock(fn.body, name, refs);
        break;
      }
      case NodeKind.VariableDecl: {
        const v = decl as any;
        if (v.name.value === name) {
          refs.push({ line: v.name.line, column: v.name.column, length: v.name.length });
        }
        if (v.initializer) this.collectRefsInExpr(v.initializer, name, refs);
        break;
      }
      case NodeKind.UniformDecl: {
        const u = decl as any;
        if (u.name.value === name) {
          refs.push({ line: u.name.line, column: u.name.column, length: u.name.length });
        }
        if (u.defaultValue) this.collectRefsInExpr(u.defaultValue, name, refs);
        break;
      }
      case NodeKind.VaryingDecl: {
        const v = decl as any;
        if (v.name.value === name) {
          refs.push({ line: v.name.line, column: v.name.column, length: v.name.length });
        }
        break;
      }
      case NodeKind.StructDecl: {
        const s = decl as any;
        if (s.name.value === name) {
          refs.push({ line: s.name.line, column: s.name.column, length: s.name.length });
        }
        break;
      }
    }
  }

  private collectRefsInBlock(block: BlockStmtNode, name: string, refs: { line: number; column: number; length: number }[]): void {
    for (const stmt of block.statements) {
      this.collectRefsInStmt(stmt, name, refs);
    }
  }

  private collectRefsInStmt(stmt: Statement, name: string, refs: { line: number; column: number; length: number }[]): void {
    switch (stmt.kind) {
      case NodeKind.VariableDecl: {
        const v = stmt as any;
        if (v.name.value === name) {
          refs.push({ line: v.name.line, column: v.name.column, length: v.name.length });
        }
        // 类型引用 (struct 类型名)
        if (v.type?.typeName?.value === name) {
          refs.push({ line: v.type.typeName.line, column: v.type.typeName.column, length: v.type.typeName.length });
        }
        if (v.initializer) this.collectRefsInExpr(v.initializer, name, refs);
        break;
      }
      case NodeKind.BlockStmt:
        this.collectRefsInBlock(stmt as BlockStmtNode, name, refs);
        break;
      case NodeKind.ExpressionStmt:
        this.collectRefsInExpr((stmt as any).expression, name, refs);
        break;
      case NodeKind.IfStmt: {
        const ifS = stmt as any;
        if (ifS.condition) this.collectRefsInExpr(ifS.condition, name, refs);
        if (ifS.thenBranch) this.collectRefsInStmtOrBlock(ifS.thenBranch, name, refs);
        if (ifS.elseBranch) this.collectRefsInStmtOrBlock(ifS.elseBranch, name, refs);
        break;
      }
      case NodeKind.ForStmt: {
        const forS = stmt as any;
        if (forS.init) this.collectRefsInStmt(forS.init, name, refs);
        if (forS.condition) this.collectRefsInExpr(forS.condition, name, refs);
        if (forS.update) this.collectRefsInExpr(forS.update, name, refs);
        if (forS.body) this.collectRefsInStmtOrBlock(forS.body, name, refs);
        break;
      }
      case NodeKind.WhileStmt: {
        const wS = stmt as any;
        if (wS.condition) this.collectRefsInExpr(wS.condition, name, refs);
        if (wS.body) this.collectRefsInStmtOrBlock(wS.body, name, refs);
        break;
      }
      case NodeKind.DoWhileStmt: {
        const dS = stmt as any;
        if (dS.body) this.collectRefsInStmtOrBlock(dS.body, name, refs);
        if (dS.condition) this.collectRefsInExpr(dS.condition, name, refs);
        break;
      }
      case NodeKind.SwitchStmt: {
        const sw = stmt as any;
        if (sw.discriminant) this.collectRefsInExpr(sw.discriminant, name, refs);
        for (const c of sw.cases ?? []) {
          if (c.value) this.collectRefsInExpr(c.value, name, refs);
          for (const s of c.body ?? []) this.collectRefsInStmt(s, name, refs);
        }
        break;
      }
      case NodeKind.ReturnStmt: {
        const ret = stmt as any;
        if (ret.value) this.collectRefsInExpr(ret.value, name, refs);
        break;
      }
    }
  }

  private collectRefsInStmtOrBlock(stmt: Statement, name: string, refs: { line: number; column: number; length: number }[]): void {
    if (stmt.kind === NodeKind.BlockStmt) {
      this.collectRefsInBlock(stmt as BlockStmtNode, name, refs);
    } else {
      this.collectRefsInStmt(stmt, name, refs);
    }
  }

  private collectRefsInExpr(expr: Expression, name: string, refs: { line: number; column: number; length: number }[]): void {
    if (!expr) return;
    switch (expr.kind) {
      case NodeKind.IdentifierExpr: {
        const id = (expr as any).name;
        if (id.value === name) {
          refs.push({ line: id.line, column: id.column, length: id.length });
        }
        break;
      }
      case NodeKind.BinaryExpr: {
        const bin = expr as any;
        this.collectRefsInExpr(bin.left, name, refs);
        this.collectRefsInExpr(bin.right, name, refs);
        break;
      }
      case NodeKind.UnaryExpr:
        this.collectRefsInExpr((expr as any).operand, name, refs);
        break;
      case NodeKind.TernaryExpr: {
        const ter = expr as any;
        this.collectRefsInExpr(ter.condition, name, refs);
        this.collectRefsInExpr(ter.consequent, name, refs);
        this.collectRefsInExpr(ter.alternate, name, refs);
        break;
      }
      case NodeKind.CallExpr: {
        const call = expr as any;
        this.collectRefsInExpr(call.callee, name, refs);
        for (const arg of call.args ?? []) this.collectRefsInExpr(arg, name, refs);
        break;
      }
      case NodeKind.IndexExpr: {
        const idx = expr as any;
        this.collectRefsInExpr(idx.object, name, refs);
        this.collectRefsInExpr(idx.index, name, refs);
        break;
      }
      case NodeKind.MemberExpr:
        // 只遍历 object, 不遍历 member (成员名不是符号引用)
        this.collectRefsInExpr((expr as any).object, name, refs);
        break;
      case NodeKind.AssignExpr: {
        const assign = expr as any;
        this.collectRefsInExpr(assign.left, name, refs);
        this.collectRefsInExpr(assign.right, name, refs);
        break;
      }
      case NodeKind.GroupExpr:
        this.collectRefsInExpr((expr as any).expression, name, refs);
        break;
      case NodeKind.ArrayInitExpr:
        for (const el of (expr as any).elements ?? []) this.collectRefsInExpr(el, name, refs);
        break;
    }
  }

  /** 去重: 同一位置可能被声明遍历和引用遍历各收集一次 */
  private dedupRefs(refs: { line: number; column: number; length: number }[]): { line: number; column: number; length: number }[] {
    const seen = new Set<string>();
    return refs.filter(r => {
      const key = `${r.line}:${r.column}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
