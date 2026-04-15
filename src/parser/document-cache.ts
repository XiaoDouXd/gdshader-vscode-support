/**
 * GDShader 文档缓存
 * 管理 per-document 的解析结果, 提供 AST 查询接口.
 */
import { Lexer, LexerDiagnostic } from './lexer';
import { Parser, ParserDiagnostic } from './parser';
import { Token } from './token';
import { ShaderFileNode, ASTNode, NodeKind } from './ast';

export interface ParseResult {
  tokens: Token[];
  ast: ShaderFileNode;
  lexerDiagnostics: LexerDiagnostic[];
  parserDiagnostics: ParserDiagnostic[];
}

/** 解析 GDShader 源文本, 返回完整的解析结果 */
export function parseShader(source: string): ParseResult {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return {
    tokens,
    ast,
    lexerDiagnostics: lexer.diagnostics,
    parserDiagnostics: parser.diagnostics,
  };
}

/** 在 AST 中查找包含指定偏移量的最内层节点 */
export function findNodeAtOffset(node: ASTNode, offset: number): ASTNode | null {
  if (offset < node.range.start.offset || offset > node.range.end.offset) {
    return null;
  }

  // 递归搜索子节点
  const children = getChildren(node);
  for (const child of children) {
    const found = findNodeAtOffset(child, offset);
    if (found) return found;
  }

  return node;
}

/** 获取节点的子节点列表 */
function getChildren(node: ASTNode): ASTNode[] {
  const children: ASTNode[] = [];
  const n = node as any;

  switch (node.kind) {
    case NodeKind.ShaderFile:
      if (n.shaderType) children.push(n.shaderType);
      if (n.renderMode) children.push(n.renderMode);
      children.push(...(n.declarations ?? []));
      break;
    case NodeKind.FunctionDecl:
      children.push(n.returnType);
      children.push(...(n.parameters ?? []));
      if (n.body) children.push(n.body);
      break;
    case NodeKind.BlockStmt:
      children.push(...(n.statements ?? []));
      break;
    case NodeKind.IfStmt:
      if (n.condition) children.push(n.condition);
      if (n.thenBranch) children.push(n.thenBranch);
      if (n.elseBranch) children.push(n.elseBranch);
      break;
    case NodeKind.ForStmt:
      if (n.init) children.push(n.init);
      if (n.condition) children.push(n.condition);
      if (n.update) children.push(n.update);
      if (n.body) children.push(n.body);
      break;
    case NodeKind.WhileStmt:
      if (n.condition) children.push(n.condition);
      if (n.body) children.push(n.body);
      break;
    case NodeKind.DoWhileStmt:
      if (n.body) children.push(n.body);
      if (n.condition) children.push(n.condition);
      break;
    case NodeKind.SwitchStmt:
      if (n.discriminant) children.push(n.discriminant);
      children.push(...(n.cases ?? []));
      break;
    case NodeKind.CaseClause:
    case NodeKind.DefaultClause:
      if (n.value) children.push(n.value);
      children.push(...(n.body ?? []));
      break;
    case NodeKind.ReturnStmt:
      if (n.value) children.push(n.value);
      break;
    case NodeKind.ExpressionStmt:
      if (n.expression) children.push(n.expression);
      break;
    case NodeKind.VariableDecl:
    case NodeKind.UniformDecl:
      if (n.type) children.push(n.type);
      if (n.arraySize) children.push(n.arraySize);
      if (n.initializer) children.push(n.initializer);
      if (n.defaultValue) children.push(n.defaultValue);
      break;
    case NodeKind.VaryingDecl:
      if (n.type) children.push(n.type);
      if (n.arraySize) children.push(n.arraySize);
      break;
    case NodeKind.StructDecl:
      children.push(...(n.members ?? []));
      break;
    case NodeKind.StructMember:
      if (n.type) children.push(n.type);
      break;
    case NodeKind.ParameterDecl:
      if (n.type) children.push(n.type);
      break;
    case NodeKind.BinaryExpr:
      children.push(n.left, n.right);
      break;
    case NodeKind.UnaryExpr:
      children.push(n.operand);
      break;
    case NodeKind.TernaryExpr:
      children.push(n.condition, n.consequent, n.alternate);
      break;
    case NodeKind.CallExpr:
      children.push(n.callee);
      children.push(...(n.args ?? []));
      break;
    case NodeKind.IndexExpr:
      children.push(n.object, n.index);
      break;
    case NodeKind.MemberExpr:
      children.push(n.object);
      break;
    case NodeKind.AssignExpr:
      children.push(n.left, n.right);
      break;
    case NodeKind.GroupExpr:
      children.push(n.expression);
      break;
    case NodeKind.ArrayInitExpr:
      children.push(...(n.elements ?? []));
      break;
  }

  return children;
}

/** 查找包含指定行列位置的最内层函数声明 */
export function findEnclosingFunction(ast: ShaderFileNode, line: number, column: number): ASTNode | null {
  for (const decl of ast.declarations) {
    if (decl.kind === NodeKind.FunctionDecl) {
      if (line >= decl.range.start.line && line <= decl.range.end.line) {
        return decl;
      }
    }
  }
  return null;
}
