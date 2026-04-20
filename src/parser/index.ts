/**
 * GDShader 解析器统一导出
 */
export { Token, TokenType, TokenRange, KEYWORD_MAP, isTypeKeyword, isAssignOp, isKeyword, isPrecisionQualifier } from './token';
export { Lexer, LexerDiagnostic } from './lexer';
export { NodeKind } from './ast';
export type {
  ASTNode, ShaderFileNode, ShaderTypeDeclNode, RenderModeDeclNode,
  FunctionDeclNode, ParameterDeclNode, VariableDeclNode,
  UniformDeclNode, VaryingDeclNode, StructDeclNode,
  BlockStmtNode, IfStmtNode, ForStmtNode, WhileStmtNode,
  ReturnStmtNode, ExpressionStmtNode,
  BinaryExprNode, UnaryExprNode, CallExprNode, MemberExprNode,
  AssignExprNode, IdentifierExprNode, LiteralExprNode,
  Expression, Statement, TopLevelDecl, ErrorNodeData,
} from './ast';
export { Parser, ParserDiagnostic } from './parser';
export { parseShader, ParseResult, findNodeAtOffset, findEnclosingFunction } from './document-cache';
export { Analyzer, Scope, SymbolInfo, SymbolKind, AnalysisResult, SemanticDiagnostic, ParameterInfo, StructMemberInfo } from './analyzer';
export { scanHints, HintScanResult, IncludeInfo, HintDef, HintTypeDef, MacroDef } from './hint-scanner';
