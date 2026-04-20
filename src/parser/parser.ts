/**
 * GDShader 递归下降解析器
 * 将 Token 流解析为 AST. 支持容错: 遇到语法错误时恢复并继续解析.
 */
import { Token, TokenType, TokenRange, tokenRange, tokenToRange, isTypeKeyword, isPrecisionQualifier, isAssignOp } from './token';
import * as AST from './ast';
import { NodeKind } from './ast';
import { loc } from '../loc';

const PROCESSOR_NAMES = new Set(['vertex', 'fragment', 'light', 'start', 'process', 'sky', 'fog']);

export interface ParserDiagnostic {
  range: TokenRange;
  message: string;
}

export class Parser {
  private tokens: Token[] = [];
  private pos = 0;
  readonly diagnostics: ParserDiagnostic[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /** 解析整个文件 */
  parse(): AST.ShaderFileNode {
    this.pos = 0;
    this.diagnostics.length = 0;

    let shaderType: AST.ShaderTypeDeclNode | null = null;
    let renderMode: AST.RenderModeDeclNode | null = null;
    const declarations: AST.TopLevelDecl[] = [];
    const startTok = this.current();

    // shader_type
    if (this.check(TokenType.KwShaderType)) {
      shaderType = this.parseShaderTypeDecl();
    }

    // render_mode
    if (this.check(TokenType.KwRenderMode)) {
      renderMode = this.parseRenderModeDecl();
    }

    // 顶层声明
    while (!this.isAtEnd()) {
      const prevPos = this.pos;
      const decl = this.parseTopLevelDecl();
      if (decl) declarations.push(decl);
      // 安全保障: 如果 pos 没有前进, 强制跳过一个 token 防止死循环
      if (this.pos === prevPos && !this.isAtEnd()) {
        this.advance();
      }
    }

    const endTok = this.tokens[this.tokens.length - 1];
    return {
      kind: NodeKind.ShaderFile,
      range: tokenRange(startTok, endTok),
      shaderType,
      renderMode,
      declarations,
    };
  }

  // ═══════════════════════════════════════════
  // 顶层声明
  // ═══════════════════════════════════════════

  private parseShaderTypeDecl(): AST.ShaderTypeDeclNode {
    const start = this.expect(TokenType.KwShaderType);
    const typeName = this.advance(); // shader type value
    this.expect(TokenType.Semicolon);
    return { kind: NodeKind.ShaderTypeDecl, range: tokenRange(start, this.prev()), typeName };
  }

  private parseRenderModeDecl(): AST.RenderModeDeclNode {
    const start = this.expect(TokenType.KwRenderMode);
    const modes: Token[] = [];
    modes.push(this.advance());
    while (this.match(TokenType.Comma)) {
      modes.push(this.advance());
    }
    this.expect(TokenType.Semicolon);
    return { kind: NodeKind.RenderModeDecl, range: tokenRange(start, this.prev()), modes };
  }

  private parseTopLevelDecl(): AST.TopLevelDecl | null {
    // 预处理器
    if (this.check(TokenType.Preprocessor)) {
      return this.parsePreprocessor();
    }
    // group_uniforms
    if (this.check(TokenType.KwGroupUniforms)) {
      return this.parseGroupUniforms();
    }
    // struct
    if (this.check(TokenType.KwStruct)) {
      return this.parseStructDecl();
    }
    // uniform (possibly with global/instance prefix)
    if (this.check(TokenType.KwUniform) || this.check(TokenType.KwGlobal) || this.check(TokenType.KwInstance)) {
      if (this.check(TokenType.KwUniform)) {
        return this.parseUniformDecl([]);
      }
      const qual = this.advance();
      if (this.check(TokenType.KwUniform)) {
        return this.parseUniformDecl([qual]);
      }
      // 不是 uniform, 回退当错误处理
      return this.errorRecover(loc('parser.unexpectedToken', qual.value));
    }
    // varying
    if (this.check(TokenType.KwVarying) || this.check(TokenType.KwFlat) || this.check(TokenType.KwSmooth)) {
      return this.parseVaryingDecl();
    }
    // const (全局)
    if (this.check(TokenType.KwConst)) {
      return this.parseVariableDecl(true);
    }
    // 函数声明: type name(
    if (this.isTypeToken() || this.check(TokenType.Identifier)) {
      return this.parseFunctionOrVarDecl();
    }

    // 无法解析
    return this.errorRecover(loc('parser.unexpectedTopLevel', this.current().value));
  }

  private parsePreprocessor(): AST.PreprocessorDirectiveNode {
    const tok = this.advance();
    return { kind: NodeKind.PreprocessorDirective, range: tokenToRange(tok), token: tok };
  }

  private parseGroupUniforms(): AST.GroupUniformsDeclNode {
    const start = this.expect(TokenType.KwGroupUniforms);
    let groupName: Token | null = null;
    let subgroupName: Token | null = null;
    if (this.check(TokenType.Identifier)) {
      groupName = this.advance();
      if (this.match(TokenType.Dot)) {
        if (this.check(TokenType.Identifier)) {
          subgroupName = this.advance();
        }
      }
    }
    this.expect(TokenType.Semicolon);
    return { kind: NodeKind.GroupUniformsDecl, range: tokenRange(start, this.prev()), groupName, subgroupName };
  }

  private parseStructDecl(): AST.StructDeclNode {
    const start = this.expect(TokenType.KwStruct);
    const name = this.expect(TokenType.Identifier);
    this.expect(TokenType.LBrace);
    const members: AST.StructMemberNode[] = [];
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      members.push(this.parseStructMember());
    }
    this.expect(TokenType.RBrace);
    this.expect(TokenType.Semicolon);
    return { kind: NodeKind.StructDecl, range: tokenRange(start, this.prev()), name, members };
  }

  private parseStructMember(): AST.StructMemberNode {
    const type = this.parseTypeRef();
    const name = this.expect(TokenType.Identifier);
    let arraySize: AST.Expression | null = null;
    if (this.match(TokenType.LBracket)) {
      if (!this.check(TokenType.RBracket)) arraySize = this.parseExpression();
      this.expect(TokenType.RBracket);
    }
    this.expect(TokenType.Semicolon);
    return { kind: NodeKind.StructMember, range: tokenRange(type.range.start as any as Token, this.prev()), type, name, arraySize };
  }

  private parseUniformDecl(qualifiers: Token[]): AST.UniformDeclNode {
    const start = qualifiers.length > 0 ? qualifiers[0] : this.current();
    this.expect(TokenType.KwUniform);
    const type = this.parseTypeRef();
    const name = this.expect(TokenType.Identifier);
    let arraySize: AST.Expression | null = null;
    if (this.match(TokenType.LBracket)) {
      if (!this.check(TokenType.RBracket)) arraySize = this.parseExpression();
      this.expect(TokenType.RBracket);
    }
    const hints: AST.UniformHintNode[] = [];
    if (this.match(TokenType.Colon)) {
      this.parseUniformHints(hints);
    }
    let defaultValue: AST.Expression | null = null;
    if (this.match(TokenType.Assign)) {
      defaultValue = this.parseExpression();
    }
    this.expect(TokenType.Semicolon);
    return {
      kind: NodeKind.UniformDecl, range: tokenRange(start, this.prev()),
      qualifiers, type, name, arraySize, hints, defaultValue,
    };
  }

  private parseUniformHints(hints: AST.UniformHintNode[]): void {
    do {
      if (!this.check(TokenType.Identifier)) break;
      const hintName = this.advance();
      const args: AST.Expression[] = [];
      if (this.match(TokenType.LParen)) {
        if (!this.check(TokenType.RParen)) {
          args.push(this.parseExpression());
          while (this.match(TokenType.Comma)) {
            args.push(this.parseExpression());
          }
        }
        this.expect(TokenType.RParen);
      }
      hints.push({ name: hintName, args });
    } while (this.match(TokenType.Comma));
  }

  private parseVaryingDecl(): AST.VaryingDeclNode {
    const start = this.current();
    let interpolation: Token | null = null;
    if (this.check(TokenType.KwFlat) || this.check(TokenType.KwSmooth)) {
      interpolation = this.advance();
    }
    this.expect(TokenType.KwVarying);
    const type = this.parseTypeRef();
    const name = this.expect(TokenType.Identifier);
    let arraySize: AST.Expression | null = null;
    if (this.match(TokenType.LBracket)) {
      if (!this.check(TokenType.RBracket)) arraySize = this.parseExpression();
      this.expect(TokenType.RBracket);
    }
    this.expect(TokenType.Semicolon);
    return {
      kind: NodeKind.VaryingDecl, range: tokenRange(start, this.prev()),
      interpolation, type, name, arraySize,
    };
  }

  /** 解析函数声明或全局变量声明 */
  private parseFunctionOrVarDecl(): AST.TopLevelDecl {
    // 前瞻: type name ( -> 函数, type name ; 或 = -> 变量
    const saved = this.pos;
    // 尝试解析类型
    if (this.check(TokenType.KwConst)) {
      return this.parseVariableDecl(true);
    }

    const type = this.parseTypeRef();
    if (!this.check(TokenType.Identifier)) {
      this.pos = saved;
      return this.errorRecover(loc('parser.expectIdentifier', this.current().value));
    }
    const name = this.advance();

    // 函数声明
    if (this.check(TokenType.LParen)) {
      return this.parseFunctionDeclBody(type, name);
    }

    // 全局变量声明
    return this.finishVariableDecl(false, null, type, name);
  }

  private parseFunctionDeclBody(returnType: AST.TypeRefNode, name: Token): AST.FunctionDeclNode {
    this.expect(TokenType.LParen);
    const parameters: AST.ParameterDeclNode[] = [];
    if (!this.check(TokenType.RParen)) {
      parameters.push(this.parseParameter());
      while (this.match(TokenType.Comma)) {
        parameters.push(this.parseParameter());
      }
    }
    this.expect(TokenType.RParen);
    const body = this.check(TokenType.LBrace) ? this.parseBlock() : null;
    const isProcessorFunction = PROCESSOR_NAMES.has(name.value);
    return {
      kind: NodeKind.FunctionDecl,
      range: tokenRange(returnType.typeName, this.prev()),
      returnType, name, parameters, body, isProcessorFunction,
    };
  }

  private parseParameter(): AST.ParameterDeclNode {
    const start = this.current();
    const qualifiers: Token[] = [];
    while (this.check(TokenType.KwIn) || this.check(TokenType.KwOut) ||
      this.check(TokenType.KwInout) || this.check(TokenType.KwConst)) {
      qualifiers.push(this.advance());
    }
    const type = this.parseTypeRef();
    const name = this.expect(TokenType.Identifier);
    // 支持 C 风格数组参数: type name[N]
    let arraySize: AST.Expression | null = null;
    if (this.match(TokenType.LBracket)) {
      if (!this.check(TokenType.RBracket)) arraySize = this.parseExpression();
      this.expect(TokenType.RBracket);
    }
    return { kind: NodeKind.ParameterDecl, range: tokenRange(start, this.prev()), qualifiers, type, name, arraySize };
  }

  // ═══════════════════════════════════════════
  // 类型引用
  // ═══════════════════════════════════════════

  private parseTypeRef(): AST.TypeRefNode {
    // 跳过可选的精度限定符
    if (isPrecisionQualifier(this.current().type)) {
      this.advance();
    }
    const typeName = this.advance();
    let arraySize: AST.Expression | null = null;
    if (this.match(TokenType.LBracket)) {
      if (!this.check(TokenType.RBracket)) arraySize = this.parseExpression();
      this.expect(TokenType.RBracket);
    }
    return { kind: NodeKind.TypeRef, range: tokenRange(typeName, this.prev()), typeName, arraySize };
  }

  private isTypeToken(): boolean {
    return isTypeKeyword(this.current().type);
  }

  // ═══════════════════════════════════════════
  // 语句
  // ═══════════════════════════════════════════

  private parseBlock(): AST.BlockStmtNode {
    const start = this.expect(TokenType.LBrace);
    const statements: AST.Statement[] = [];
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }
    this.expect(TokenType.RBrace);
    return { kind: NodeKind.BlockStmt, range: tokenRange(start, this.prev()), statements };
  }

  private parseStatement(): AST.Statement | null {
    // 块
    if (this.check(TokenType.LBrace)) return this.parseBlock();
    // if
    if (this.check(TokenType.KwIf)) return this.parseIfStmt();
    // for
    if (this.check(TokenType.KwFor)) return this.parseForStmt();
    // while
    if (this.check(TokenType.KwWhile)) return this.parseWhileStmt();
    // do-while
    if (this.check(TokenType.KwDo)) return this.parseDoWhileStmt();
    // switch
    if (this.check(TokenType.KwSwitch)) return this.parseSwitchStmt();
    // return
    if (this.check(TokenType.KwReturn)) return this.parseReturnStmt();
    // break
    if (this.check(TokenType.KwBreak)) {
      const tok = this.advance();
      this.expect(TokenType.Semicolon);
      return { kind: NodeKind.BreakStmt, range: tokenRange(tok, this.prev()) };
    }
    // continue
    if (this.check(TokenType.KwContinue)) {
      const tok = this.advance();
      this.expect(TokenType.Semicolon);
      return { kind: NodeKind.ContinueStmt, range: tokenRange(tok, this.prev()) };
    }
    // discard
    if (this.check(TokenType.KwDiscard)) {
      const tok = this.advance();
      this.expect(TokenType.Semicolon);
      return { kind: NodeKind.DiscardStmt, range: tokenRange(tok, this.prev()) };
    }
    // 预处理器
    if (this.check(TokenType.Preprocessor)) {
      this.advance(); // 跳过预处理器 (作为语句级, 不影响 AST 结构)
      return null;
    }
    // 变量声明: const? precision? type identifier
    if (this.check(TokenType.KwConst)) return this.parseVariableDecl(true);
    if (this.isVarDeclStart()) return this.parseVariableDecl(false);

    // 表达式语句
    return this.parseExpressionStmt();
  }

  private isVarDeclStart(): boolean {
    // 内置类型关键字 或 精度限定符 开头
    if (this.isTypeToken() || isPrecisionQualifier(this.current().type)) {
      // 前瞻: 类型后跟标识符(非括号) = 变量声明
      const saved = this.pos;
      if (isPrecisionQualifier(this.current().type)) this.pos++;
      if (isTypeKeyword(this.current().type) || this.current().type === TokenType.Identifier) {
        this.pos++;
        // 跳过可能的数组 []
        if (this.current().type === TokenType.LBracket) {
          let depth = 1;
          this.pos++;
          while (depth > 0 && this.pos < this.tokens.length) {
            if (this.current().type === TokenType.LBracket) depth++;
            if (this.current().type === TokenType.RBracket) depth--;
            this.pos++;
          }
        }
        const result = this.current().type === TokenType.Identifier;
        this.pos = saved;
        return result;
      }
      this.pos = saved;
      return false;
    }

    // Struct 类型名: Identifier 后面跟 Identifier (不是 "(" — 那是函数调用/构造器)
    if (this.current().type === TokenType.Identifier) {
      const saved = this.pos;
      this.pos++; // skip struct type name
      // 跳过可能的数组 []
      if (this.current().type === TokenType.LBracket) {
        let depth = 1;
        this.pos++;
        while (depth > 0 && this.pos < this.tokens.length) {
          if (this.current().type === TokenType.LBracket) depth++;
          if (this.current().type === TokenType.RBracket) depth--;
          this.pos++;
        }
      }
      const result = this.current().type === TokenType.Identifier;
      this.pos = saved;
      return result;
    }

    return false;
  }

  private parseVariableDecl(isConst: boolean): AST.VariableDeclNode {
    if (isConst) this.expect(TokenType.KwConst);
    let precision: Token | null = null;
    if (isPrecisionQualifier(this.current().type)) {
      precision = this.advance();
    }
    const type = this.parseTypeRef();
    const name = this.expect(TokenType.Identifier);
    return this.finishVariableDecl(isConst, precision, type, name);
  }

  private finishVariableDecl(
    isConst: boolean, precision: Token | null,
    type: AST.TypeRefNode, name: Token
  ): AST.VariableDeclNode {
    let arraySize: AST.Expression | null = null;
    if (this.match(TokenType.LBracket)) {
      if (!this.check(TokenType.RBracket)) arraySize = this.parseExpression();
      this.expect(TokenType.RBracket);
    }
    let initializer: AST.Expression | null = null;
    if (this.match(TokenType.Assign)) {
      initializer = this.parseExpression();
    }
    this.expect(TokenType.Semicolon);
    return {
      kind: NodeKind.VariableDecl,
      range: tokenRange(type.typeName, this.prev()),
      isConst, precision, type, name, arraySize, initializer,
    };
  }

  private parseIfStmt(): AST.IfStmtNode {
    const start = this.expect(TokenType.KwIf);
    let condition: AST.Expression | null = null;
    if (this.match(TokenType.LParen)) {
      condition = this.parseExpression();
      this.expect(TokenType.RParen);
    }
    const thenBranch = this.parseStatement() ?? this.makeErrorNode(loc('parser.missingIfBody'));
    let elseBranch: AST.Statement | null = null;
    if (this.match(TokenType.KwElse)) {
      elseBranch = this.parseStatement();
    }
    return {
      kind: NodeKind.IfStmt,
      range: tokenRange(start, this.prev()),
      condition, thenBranch, elseBranch,
    };
  }

  private parseForStmt(): AST.ForStmtNode {
    const start = this.expect(TokenType.KwFor);
    this.expect(TokenType.LParen);
    let init: AST.Statement | null = null;
    if (!this.check(TokenType.Semicolon)) {
      if (this.isVarDeclStart() || this.check(TokenType.KwConst)) {
        init = this.parseVariableDecl(this.check(TokenType.KwConst));
      } else {
        init = this.parseExpressionStmt();
      }
    } else {
      this.advance(); // ;
    }
    let condition: AST.Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      condition = this.parseExpression();
    }
    this.expect(TokenType.Semicolon);
    let update: AST.Expression | null = null;
    if (!this.check(TokenType.RParen)) {
      update = this.parseExpression();
    }
    this.expect(TokenType.RParen);
    const body = this.parseStatement() ?? this.makeErrorNode(loc('parser.missingForBody'));
    return {
      kind: NodeKind.ForStmt,
      range: tokenRange(start, this.prev()),
      init, condition, update, body,
    };
  }

  private parseWhileStmt(): AST.WhileStmtNode {
    const start = this.expect(TokenType.KwWhile);
    this.expect(TokenType.LParen);
    const condition = this.parseExpression();
    this.expect(TokenType.RParen);
    const body = this.parseStatement() ?? this.makeErrorNode(loc('parser.missingWhileBody'));
    return { kind: NodeKind.WhileStmt, range: tokenRange(start, this.prev()), condition, body };
  }

  private parseDoWhileStmt(): AST.DoWhileStmtNode {
    const start = this.expect(TokenType.KwDo);
    const body = this.parseStatement() ?? this.makeErrorNode(loc('parser.missingDoBody'));
    this.expect(TokenType.KwWhile);
    this.expect(TokenType.LParen);
    const condition = this.parseExpression();
    this.expect(TokenType.RParen);
    this.expect(TokenType.Semicolon);
    return { kind: NodeKind.DoWhileStmt, range: tokenRange(start, this.prev()), body, condition };
  }

  private parseSwitchStmt(): AST.SwitchStmtNode {
    const start = this.expect(TokenType.KwSwitch);
    this.expect(TokenType.LParen);
    const discriminant = this.parseExpression();
    this.expect(TokenType.RParen);
    this.expect(TokenType.LBrace);
    const cases: (AST.CaseClauseNode | AST.DefaultClauseNode)[] = [];
    while (!this.check(TokenType.RBrace) && !this.isAtEnd()) {
      if (this.check(TokenType.KwCase)) {
        cases.push(this.parseCaseClause());
      } else if (this.check(TokenType.KwDefault)) {
        cases.push(this.parseDefaultClause());
      } else {
        this.errorRecover(loc('parser.switchUnexpected', this.current().value));
      }
    }
    this.expect(TokenType.RBrace);
    return { kind: NodeKind.SwitchStmt, range: tokenRange(start, this.prev()), discriminant, cases };
  }

  private parseCaseClause(): AST.CaseClauseNode {
    const start = this.expect(TokenType.KwCase);
    const value = this.parseExpression();
    this.expect(TokenType.Colon);
    const body: AST.Statement[] = [];
    while (!this.check(TokenType.KwCase) && !this.check(TokenType.KwDefault) &&
      !this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const s = this.parseStatement();
      if (s) body.push(s);
    }
    return { kind: NodeKind.CaseClause, range: tokenRange(start, this.prev()), value, body };
  }

  private parseDefaultClause(): AST.DefaultClauseNode {
    const start = this.expect(TokenType.KwDefault);
    this.expect(TokenType.Colon);
    const body: AST.Statement[] = [];
    while (!this.check(TokenType.KwCase) && !this.check(TokenType.KwDefault) &&
      !this.check(TokenType.RBrace) && !this.isAtEnd()) {
      const s = this.parseStatement();
      if (s) body.push(s);
    }
    return { kind: NodeKind.DefaultClause, range: tokenRange(start, this.prev()), body };
  }

  private parseReturnStmt(): AST.ReturnStmtNode {
    const start = this.expect(TokenType.KwReturn);
    let value: AST.Expression | null = null;
    if (!this.check(TokenType.Semicolon)) {
      value = this.parseExpression();
    }
    this.expect(TokenType.Semicolon);
    return { kind: NodeKind.ReturnStmt, range: tokenRange(start, this.prev()), value };
  }

  private parseExpressionStmt(): AST.ExpressionStmtNode {
    const expr = this.parseExpression();
    this.expect(TokenType.Semicolon);
    return { kind: NodeKind.ExpressionStmt, range: expr.range, expression: expr };
  }

  // ═══════════════════════════════════════════
  // 表达式 (按优先级, 递归下降)
  // ═══════════════════════════════════════════

  private parseExpression(): AST.Expression {
    return this.parseAssignExpr();
  }

  private parseAssignExpr(): AST.Expression {
    const left = this.parseTernaryExpr();
    if (isAssignOp(this.current().type)) {
      const op = this.advance();
      const right = this.parseAssignExpr();
      return { kind: NodeKind.AssignExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseTernaryExpr(): AST.Expression {
    const condition = this.parseLogicOrExpr();
    if (this.match(TokenType.Question)) {
      const consequent = this.parseExpression();
      this.expect(TokenType.Colon);
      const alternate = this.parseTernaryExpr();
      return { kind: NodeKind.TernaryExpr, range: tokenRange(condition.range.start as any, this.prev()), condition, consequent, alternate };
    }
    return condition;
  }

  private parseLogicOrExpr(): AST.Expression {
    let left = this.parseLogicAndExpr();
    while (this.check(TokenType.PipePipe)) {
      const op = this.advance();
      const right = this.parseLogicAndExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseLogicAndExpr(): AST.Expression {
    let left = this.parseBitwiseOrExpr();
    while (this.check(TokenType.AmpAmp)) {
      const op = this.advance();
      const right = this.parseBitwiseOrExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseBitwiseOrExpr(): AST.Expression {
    let left = this.parseBitwiseXorExpr();
    while (this.check(TokenType.Pipe)) {
      const op = this.advance();
      const right = this.parseBitwiseXorExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseBitwiseXorExpr(): AST.Expression {
    let left = this.parseBitwiseAndExpr();
    while (this.check(TokenType.Caret)) {
      const op = this.advance();
      const right = this.parseBitwiseAndExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseBitwiseAndExpr(): AST.Expression {
    let left = this.parseEqualityExpr();
    while (this.check(TokenType.Amp)) {
      const op = this.advance();
      const right = this.parseEqualityExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseEqualityExpr(): AST.Expression {
    let left = this.parseRelationalExpr();
    while (this.check(TokenType.EqualEqual) || this.check(TokenType.BangEqual)) {
      const op = this.advance();
      const right = this.parseRelationalExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseRelationalExpr(): AST.Expression {
    let left = this.parseShiftExpr();
    while (this.check(TokenType.Less) || this.check(TokenType.Greater) ||
      this.check(TokenType.LessEqual) || this.check(TokenType.GreaterEqual)) {
      const op = this.advance();
      const right = this.parseShiftExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseShiftExpr(): AST.Expression {
    let left = this.parseAdditiveExpr();
    while (this.check(TokenType.LShift) || this.check(TokenType.RShift)) {
      const op = this.advance();
      const right = this.parseAdditiveExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseAdditiveExpr(): AST.Expression {
    let left = this.parseMultiplicativeExpr();
    while (this.check(TokenType.Plus) || this.check(TokenType.Minus)) {
      const op = this.advance();
      const right = this.parseMultiplicativeExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseMultiplicativeExpr(): AST.Expression {
    let left = this.parseUnaryExpr();
    while (this.check(TokenType.Star) || this.check(TokenType.Slash) || this.check(TokenType.Percent)) {
      const op = this.advance();
      const right = this.parseUnaryExpr();
      left = { kind: NodeKind.BinaryExpr, range: tokenRange(left.range.start as any, this.prev()), operator: op, left, right };
    }
    return left;
  }

  private parseUnaryExpr(): AST.Expression {
    if (this.check(TokenType.Plus) || this.check(TokenType.Minus) ||
      this.check(TokenType.Bang) || this.check(TokenType.Tilde) ||
      this.check(TokenType.PlusPlus) || this.check(TokenType.MinusMinus)) {
      const op = this.advance();
      const operand = this.parseUnaryExpr();
      return { kind: NodeKind.UnaryExpr, range: tokenRange(op, this.prev()), operator: op, operand };
    }
    return this.parsePostfixExpr();
  }

  private parsePostfixExpr(): AST.Expression {
    let expr = this.parsePrimaryExpr();

    while (true) {
      if (this.check(TokenType.Dot)) {
        this.advance();
        const member = this.expect(TokenType.Identifier);
        expr = { kind: NodeKind.MemberExpr, range: tokenRange(expr.range.start as any, member), object: expr, member };
      } else if (this.check(TokenType.LBracket)) {
        this.advance();
        // 支持数组构造器的空维度 `type[](args)` 或有维度 `type[3](args)`
        let index: AST.Expression | null = null;
        if (!this.check(TokenType.RBracket)) {
          index = this.parseExpression();
        }
        this.expect(TokenType.RBracket);
        expr = { kind: NodeKind.IndexExpr, range: tokenRange(expr.range.start as any, this.prev()), object: expr, index };
      } else if (this.check(TokenType.LParen)) {
        this.advance();
        const args: AST.Expression[] = [];
        if (!this.check(TokenType.RParen)) {
          args.push(this.parseExpression());
          while (this.match(TokenType.Comma)) {
            args.push(this.parseExpression());
          }
        }
        this.expect(TokenType.RParen);
        expr = { kind: NodeKind.CallExpr, range: tokenRange(expr.range.start as any, this.prev()), callee: expr, args };
      } else if (this.check(TokenType.PlusPlus) || this.check(TokenType.MinusMinus)) {
        // 后缀 ++ / --
        const op = this.advance();
        expr = { kind: NodeKind.UnaryExpr, range: tokenRange(expr.range.start as any, op), operator: op, operand: expr };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimaryExpr(): AST.Expression {
    const tok = this.current();

    // 类型构造: vec3(...), float[3](...)
    if (isTypeKeyword(tok.type)) {
      const typeTok = this.advance();
      // 类型后跟 [ (数组构造) 或 ( (普通构造)
      // 让 postfix 处理 ( 和 [
      return { kind: NodeKind.IdentifierExpr, range: tokenToRange(typeTok), name: typeTok };
    }

    // 标识符
    if (tok.type === TokenType.Identifier) {
      this.advance();
      return { kind: NodeKind.IdentifierExpr, range: tokenToRange(tok), name: tok };
    }

    // 数值/布尔字面量
    if (tok.type === TokenType.IntLiteral || tok.type === TokenType.UintLiteral ||
      tok.type === TokenType.FloatLiteral || tok.type === TokenType.BoolLiteral ||
      tok.type === TokenType.StringLiteral) {
      this.advance();
      return { kind: NodeKind.LiteralExpr, range: tokenToRange(tok), token: tok };
    }

    // 括号分组
    if (tok.type === TokenType.LParen) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RParen);
      return { kind: NodeKind.GroupExpr, range: tokenRange(tok, this.prev()), expression: expr };
    }

    // 数组初始化 { ... }
    if (tok.type === TokenType.LBrace) {
      return this.parseArrayInit();
    }

    // 错误恢复
    this.advance();
    this.addDiagnostic(tok, loc('parser.unexpectedToken', tok.value));
    return { kind: NodeKind.ErrorNode, range: tokenToRange(tok), message: loc('parser.unexpectedToken', tok.value), tokens: [tok] };
  }

  private parseArrayInit(): AST.ArrayInitExprNode {
    const start = this.expect(TokenType.LBrace);
    const elements: AST.Expression[] = [];
    if (!this.check(TokenType.RBrace)) {
      elements.push(this.parseExpression());
      while (this.match(TokenType.Comma)) {
        if (this.check(TokenType.RBrace)) break; // 尾逗号
        elements.push(this.parseExpression());
      }
    }
    this.expect(TokenType.RBrace);
    return { kind: NodeKind.ArrayInitExpr, range: tokenRange(start, this.prev()), elements };
  }

  // ═══════════════════════════════════════════
  // 辅助方法
  // ═══════════════════════════════════════════

  private current(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
  }

  private prev(): Token {
    return this.tokens[Math.max(0, this.pos - 1)];
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private advance(): Token {
    const tok = this.current();
    if (!this.isAtEnd()) this.pos++;
    return tok;
  }

  private expect(type: TokenType): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const tok = this.current();
    this.addDiagnostic(tok, loc('parser.expect', TokenType[type], tok.value));
    // 不消费 token, 返回一个合成的 token
    return { type, value: '', line: tok.line, column: tok.column, offset: tok.offset, length: 0 };
  }

  private addDiagnostic(token: Token, message: string): void {
    this.diagnostics.push({ range: tokenToRange(token), message });
  }

  private errorRecover(message: string): AST.ErrorNodeData {
    const start = this.current();
    this.addDiagnostic(start, message);
    const skipped: Token[] = [];

    // 跳到下一个同步点
    while (!this.isAtEnd()) {
      const t = this.current().type;
      if (t === TokenType.Semicolon) { skipped.push(this.advance()); break; }
      if (t === TokenType.RBrace) { break; }
      if (t === TokenType.KwShaderType || t === TokenType.KwRenderMode ||
        t === TokenType.KwUniform || t === TokenType.KwVarying ||
        t === TokenType.KwConst || t === TokenType.KwStruct ||
        t === TokenType.KwGroupUniforms) { break; }
      if (isTypeKeyword(t) && this.pos + 1 < this.tokens.length &&
        this.tokens[this.pos + 1].type === TokenType.Identifier) { break; }
      skipped.push(this.advance());
    }

    // 安全保障: 如果没有跳过任何 token, 强制消费当前 token 防止死循环
    if (skipped.length === 0 && !this.isAtEnd()) {
      skipped.push(this.advance());
    }

    return {
      kind: NodeKind.ErrorNode,
      range: skipped.length > 0 ? tokenRange(start, skipped[skipped.length - 1]) : tokenToRange(start),
      message, tokens: skipped,
    };
  }

  private makeErrorNode(message: string): AST.ErrorNodeData {
    const tok = this.current();
    this.addDiagnostic(tok, message);
    return { kind: NodeKind.ErrorNode, range: tokenToRange(tok), message, tokens: [] };
  }
}
