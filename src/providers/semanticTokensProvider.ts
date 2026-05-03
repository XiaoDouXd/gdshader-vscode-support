/**
 * GDShader 语义高亮提供器
 *
 * 为自定义 struct 类型名在使用处提供类型颜色高亮.
 * 基于 AST 遍历, 精确识别 struct 名出现的位置, 避免误标注释/字符串/成员访问内容.
 *
 * 识别以下使用场景并着成 type:
 * - struct 声明本身的名字:  `struct MyStruct { ... };`
 * - 类型引用 (变量/参数/uniform/varying 等声明的类型部分): `MyStruct s;`
 * - struct 构造器调用: `MyStruct(...)`
 * - 函数返回类型: `MyStruct make() { ... }`
 * - 字段访问的 object 类型不受影响, 仅 object 是 struct 名 (如通过 `MyStruct.SOMETHING` 静态引用) 时着色
 *
 * 不会着色:
 * - struct 实例的成员名 (`s.field` 中的 `field`)
 * - 字符串 / 注释 / swizzle 等
 */
import * as vscode from 'vscode';
import { DocumentManager } from './document-manager';
import {
  NodeKind,
  ShaderFileNode, TopLevelDecl,
  FunctionDeclNode, ParameterDeclNode, VariableDeclNode, UniformDeclNode,
  VaryingDeclNode, StructDeclNode,
  BlockStmtNode, Statement, Expression,
} from '../parser/ast';
import { Token } from '../parser/token';

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

    const pushIfStructToken = (tok: Token | undefined | null): void => {
      if (!tok) return;
      if (structNames.has(tok.value)) {
        builder.push(tok.line, tok.column, tok.length, 0 /* type */);
      }
    };

    // 遍历 AST
    const ast: ShaderFileNode = info.result.ast;
    for (const decl of ast.declarations) {
      this.visitTopLevel(decl, pushIfStructToken);
    }

    return builder.build();
  }

  private visitTopLevel(decl: TopLevelDecl, push: (t: Token | undefined | null) => void): void {
    switch (decl.kind) {
      case NodeKind.StructDecl: {
        const s = decl as StructDeclNode;
        push(s.name);
        for (const m of s.members) {
          push(m.type.typeName);
          if (m.arraySize) this.visitExpr(m.arraySize, push);
        }
        break;
      }
      case NodeKind.FunctionDecl: {
        const fn = decl as FunctionDeclNode;
        push(fn.returnType.typeName);
        for (const p of fn.parameters) this.visitParameter(p, push);
        if (fn.body) this.visitBlock(fn.body, push);
        break;
      }
      case NodeKind.UniformDecl: {
        const u = decl as UniformDeclNode;
        push(u.type.typeName);
        if (u.arraySize) this.visitExpr(u.arraySize, push);
        if (u.defaultValue) this.visitExpr(u.defaultValue, push);
        for (const h of u.hints) {
          for (const arg of h.args) this.visitExpr(arg, push);
        }
        break;
      }
      case NodeKind.VaryingDecl: {
        const v = decl as VaryingDeclNode;
        push(v.type.typeName);
        if (v.arraySize) this.visitExpr(v.arraySize, push);
        break;
      }
      case NodeKind.VariableDecl: {
        const v = decl as VariableDeclNode;
        push(v.type.typeName);
        if (v.arraySize) this.visitExpr(v.arraySize, push);
        if (v.initializer) this.visitExpr(v.initializer, push);
        break;
      }
    }
  }

  private visitParameter(p: ParameterDeclNode, push: (t: Token | undefined | null) => void): void {
    push(p.type.typeName);
    if (p.arraySize) this.visitExpr(p.arraySize, push);
  }

  private visitBlock(block: BlockStmtNode, push: (t: Token | undefined | null) => void): void {
    for (const stmt of block.statements) this.visitStmt(stmt, push);
  }

  private visitStmt(stmt: Statement, push: (t: Token | undefined | null) => void): void {
    switch (stmt.kind) {
      case NodeKind.VariableDecl: {
        const v = stmt as VariableDeclNode;
        push(v.type.typeName);
        if (v.arraySize) this.visitExpr(v.arraySize, push);
        if (v.initializer) this.visitExpr(v.initializer, push);
        break;
      }
      case NodeKind.BlockStmt:
        this.visitBlock(stmt as BlockStmtNode, push);
        break;
      case NodeKind.ExpressionStmt:
        this.visitExpr((stmt as any).expression, push);
        break;
      case NodeKind.IfStmt: {
        const s = stmt as any;
        if (s.condition) this.visitExpr(s.condition, push);
        if (s.thenBranch) this.visitStmt(s.thenBranch, push);
        if (s.elseBranch) this.visitStmt(s.elseBranch, push);
        break;
      }
      case NodeKind.ForStmt: {
        const s = stmt as any;
        if (s.init) this.visitStmt(s.init, push);
        if (s.condition) this.visitExpr(s.condition, push);
        if (s.update) this.visitExpr(s.update, push);
        if (s.body) this.visitStmt(s.body, push);
        break;
      }
      case NodeKind.WhileStmt: {
        const s = stmt as any;
        if (s.condition) this.visitExpr(s.condition, push);
        if (s.body) this.visitStmt(s.body, push);
        break;
      }
      case NodeKind.DoWhileStmt: {
        const s = stmt as any;
        if (s.body) this.visitStmt(s.body, push);
        if (s.condition) this.visitExpr(s.condition, push);
        break;
      }
      case NodeKind.SwitchStmt: {
        const s = stmt as any;
        if (s.discriminant) this.visitExpr(s.discriminant, push);
        for (const c of s.cases ?? []) {
          if (c.value) this.visitExpr(c.value, push);
          for (const sub of c.body ?? []) this.visitStmt(sub, push);
        }
        break;
      }
      case NodeKind.ReturnStmt: {
        const s = stmt as any;
        if (s.value) this.visitExpr(s.value, push);
        break;
      }
    }
  }

  private visitExpr(expr: Expression | null | undefined, push: (t: Token | undefined | null) => void): void {
    if (!expr) return;
    switch (expr.kind) {
      case NodeKind.IdentifierExpr: {
        const id = (expr as any).name as Token;
        push(id);
        break;
      }
      case NodeKind.CallExpr: {
        const c = expr as any;
        // callee 可能是 IdentifierExpr (函数/类型构造) 或 IndexExpr (数组构造 `type[N](...)`)
        this.visitExpr(c.callee, push);
        for (const a of c.args ?? []) this.visitExpr(a, push);
        break;
      }
      case NodeKind.IndexExpr: {
        const c = expr as any;
        this.visitExpr(c.object, push);
        if (c.index) this.visitExpr(c.index, push);
        break;
      }
      case NodeKind.MemberExpr: {
        const c = expr as any;
        // 仅对 object 侧递归; 成员名不做 struct 着色
        this.visitExpr(c.object, push);
        break;
      }
      case NodeKind.BinaryExpr: {
        const c = expr as any;
        this.visitExpr(c.left, push);
        this.visitExpr(c.right, push);
        break;
      }
      case NodeKind.UnaryExpr: {
        const c = expr as any;
        this.visitExpr(c.operand, push);
        break;
      }
      case NodeKind.TernaryExpr: {
        const c = expr as any;
        this.visitExpr(c.condition, push);
        this.visitExpr(c.consequent, push);
        this.visitExpr(c.alternate, push);
        break;
      }
      case NodeKind.AssignExpr: {
        const c = expr as any;
        this.visitExpr(c.left, push);
        this.visitExpr(c.right, push);
        break;
      }
      case NodeKind.GroupExpr:
        this.visitExpr((expr as any).expression, push);
        break;
      case NodeKind.ArrayInitExpr:
        for (const el of (expr as any).elements ?? []) this.visitExpr(el, push);
        break;
    }
  }
}
