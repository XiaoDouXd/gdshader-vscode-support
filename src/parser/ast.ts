/**
 * GDShader AST 节点类型定义
 * 所有语法树节点的接口和联合类型.
 */
import { Token, TokenRange } from './token';

// ─── NodeKind 枚举 ───

export enum NodeKind {
  // 顶层
  ShaderFile,
  ShaderTypeDecl,
  RenderModeDecl,
  GroupUniformsDecl,
  PreprocessorDirective,

  // 声明
  FunctionDecl,
  ParameterDecl,
  VariableDecl,
  UniformDecl,
  VaryingDecl,
  StructDecl,
  StructMember,

  // 语句
  BlockStmt,
  ExpressionStmt,
  IfStmt,
  ForStmt,
  WhileStmt,
  DoWhileStmt,
  SwitchStmt,
  CaseClause,
  DefaultClause,
  ReturnStmt,
  BreakStmt,
  ContinueStmt,
  DiscardStmt,

  // 表达式
  BinaryExpr,
  UnaryExpr,
  TernaryExpr,
  CallExpr,
  IndexExpr,
  MemberExpr,
  AssignExpr,
  IdentifierExpr,
  LiteralExpr,
  ArrayInitExpr,
  GroupExpr,

  // 类型
  TypeRef,

  // 特殊
  ErrorNode,
}

// ─── 基础接口 ───

export interface ASTNode {
  kind: NodeKind;
  range: TokenRange;
}

// ─── 顶层节点 ───

export interface ShaderFileNode extends ASTNode {
  kind: NodeKind.ShaderFile;
  shaderType: ShaderTypeDeclNode | null;
  renderMode: RenderModeDeclNode | null;
  declarations: TopLevelDecl[];
}

export interface ShaderTypeDeclNode extends ASTNode {
  kind: NodeKind.ShaderTypeDecl;
  typeName: Token;
}

export interface RenderModeDeclNode extends ASTNode {
  kind: NodeKind.RenderModeDecl;
  modes: Token[];
}

export interface GroupUniformsDeclNode extends ASTNode {
  kind: NodeKind.GroupUniformsDecl;
  groupName: Token | null; // null = 关闭分组
  subgroupName: Token | null;
}

export interface PreprocessorDirectiveNode extends ASTNode {
  kind: NodeKind.PreprocessorDirective;
  token: Token;
}

// ─── 声明节点 ───

export interface FunctionDeclNode extends ASTNode {
  kind: NodeKind.FunctionDecl;
  returnType: TypeRefNode;
  name: Token;
  parameters: ParameterDeclNode[];
  body: BlockStmtNode | null;
  isProcessorFunction: boolean;
}

export interface ParameterDeclNode extends ASTNode {
  kind: NodeKind.ParameterDecl;
  qualifiers: Token[];
  type: TypeRefNode;
  name: Token;
}

export interface VariableDeclNode extends ASTNode {
  kind: NodeKind.VariableDecl;
  isConst: boolean;
  precision: Token | null;
  type: TypeRefNode;
  name: Token;
  arraySize: Expression | null;
  initializer: Expression | null;
}

export interface UniformHintNode {
  name: Token;
  args: Expression[];
}

export interface UniformDeclNode extends ASTNode {
  kind: NodeKind.UniformDecl;
  qualifiers: Token[];
  type: TypeRefNode;
  name: Token;
  arraySize: Expression | null;
  hints: UniformHintNode[];
  defaultValue: Expression | null;
}

export interface VaryingDeclNode extends ASTNode {
  kind: NodeKind.VaryingDecl;
  interpolation: Token | null;
  type: TypeRefNode;
  name: Token;
  arraySize: Expression | null;
}

export interface StructDeclNode extends ASTNode {
  kind: NodeKind.StructDecl;
  name: Token;
  members: StructMemberNode[];
}

export interface StructMemberNode extends ASTNode {
  kind: NodeKind.StructMember;
  type: TypeRefNode;
  name: Token;
  arraySize: Expression | null;
}

// ─── 类型引用 ───

export interface TypeRefNode extends ASTNode {
  kind: NodeKind.TypeRef;
  typeName: Token;
  arraySize: Expression | null;
}

// ─── 语句节点 ───

export interface BlockStmtNode extends ASTNode {
  kind: NodeKind.BlockStmt;
  statements: Statement[];
}

export interface ExpressionStmtNode extends ASTNode {
  kind: NodeKind.ExpressionStmt;
  expression: Expression;
}

export interface IfStmtNode extends ASTNode {
  kind: NodeKind.IfStmt;
  condition: Expression | null;
  thenBranch: Statement;
  elseBranch: Statement | null;
}

export interface ForStmtNode extends ASTNode {
  kind: NodeKind.ForStmt;
  init: Statement | null;
  condition: Expression | null;
  update: Expression | null;
  body: Statement;
}

export interface WhileStmtNode extends ASTNode {
  kind: NodeKind.WhileStmt;
  condition: Expression | null;
  body: Statement;
}

export interface DoWhileStmtNode extends ASTNode {
  kind: NodeKind.DoWhileStmt;
  body: Statement;
  condition: Expression | null;
}

export interface SwitchStmtNode extends ASTNode {
  kind: NodeKind.SwitchStmt;
  discriminant: Expression | null;
  cases: (CaseClauseNode | DefaultClauseNode)[];
}

export interface CaseClauseNode extends ASTNode {
  kind: NodeKind.CaseClause;
  value: Expression;
  body: Statement[];
}

export interface DefaultClauseNode extends ASTNode {
  kind: NodeKind.DefaultClause;
  body: Statement[];
}

export interface ReturnStmtNode extends ASTNode {
  kind: NodeKind.ReturnStmt;
  value: Expression | null;
}

export interface BreakStmtNode extends ASTNode {
  kind: NodeKind.BreakStmt;
}

export interface ContinueStmtNode extends ASTNode {
  kind: NodeKind.ContinueStmt;
}

export interface DiscardStmtNode extends ASTNode {
  kind: NodeKind.DiscardStmt;
}

// ─── 表达式节点 ───

export interface BinaryExprNode extends ASTNode {
  kind: NodeKind.BinaryExpr;
  operator: Token;
  left: Expression;
  right: Expression;
}

export interface UnaryExprNode extends ASTNode {
  kind: NodeKind.UnaryExpr;
  operator: Token;
  operand: Expression;
}

export interface TernaryExprNode extends ASTNode {
  kind: NodeKind.TernaryExpr;
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface CallExprNode extends ASTNode {
  kind: NodeKind.CallExpr;
  callee: Expression;
  args: Expression[];
}

export interface IndexExprNode extends ASTNode {
  kind: NodeKind.IndexExpr;
  object: Expression;
  index: Expression;
}

export interface MemberExprNode extends ASTNode {
  kind: NodeKind.MemberExpr;
  object: Expression;
  member: Token;
}

export interface AssignExprNode extends ASTNode {
  kind: NodeKind.AssignExpr;
  operator: Token;
  left: Expression;
  right: Expression;
}

export interface IdentifierExprNode extends ASTNode {
  kind: NodeKind.IdentifierExpr;
  name: Token;
}

export interface LiteralExprNode extends ASTNode {
  kind: NodeKind.LiteralExpr;
  token: Token;
}

export interface ArrayInitExprNode extends ASTNode {
  kind: NodeKind.ArrayInitExpr;
  elements: Expression[];
}

export interface GroupExprNode extends ASTNode {
  kind: NodeKind.GroupExpr;
  expression: Expression;
}

// ─── 错误节点 ───

export interface ErrorNodeData extends ASTNode {
  kind: NodeKind.ErrorNode;
  message: string;
  tokens: Token[];
}

// ─── 联合类型 ───

export type TopLevelDecl =
  | FunctionDeclNode
  | UniformDeclNode
  | VaryingDeclNode
  | VariableDeclNode
  | StructDeclNode
  | GroupUniformsDeclNode
  | PreprocessorDirectiveNode
  | ErrorNodeData;

export type Statement =
  | BlockStmtNode
  | ExpressionStmtNode
  | IfStmtNode
  | ForStmtNode
  | WhileStmtNode
  | DoWhileStmtNode
  | SwitchStmtNode
  | ReturnStmtNode
  | BreakStmtNode
  | ContinueStmtNode
  | DiscardStmtNode
  | VariableDeclNode
  | ErrorNodeData;

export type Expression =
  | BinaryExprNode
  | UnaryExprNode
  | TernaryExprNode
  | CallExprNode
  | IndexExprNode
  | MemberExprNode
  | AssignExprNode
  | IdentifierExprNode
  | LiteralExprNode
  | ArrayInitExprNode
  | GroupExprNode
  | ErrorNodeData;
