/**
 * GDShader 语义分析器 (Analyzer)
 * 遍历 AST, 构建符号表和作用域树, 提供上下文查询.
 *
 * 职责:
 * - 收集所有声明 (变量/函数/struct/uniform/varying/参数)
 * - 构建树形作用域 (全局 → 函数 → 块)
 * - 注入内置变量和函数到对应作用域
 * - 检测重复定义、未定义引用
 * - 提供 getVisibleSymbols / resolveSymbol 查询接口
 */
import {
  ShaderFileNode, FunctionDeclNode, VariableDeclNode, UniformDeclNode,
  VaryingDeclNode, StructDeclNode, ParameterDeclNode, BlockStmtNode,
  Statement, Expression, NodeKind, TopLevelDecl, ASTNode,
  ForStmtNode, StructMemberNode,
} from './ast';
import { Token, TokenRange, TokenType } from './token';
import {
  BUILTIN_VARS, BUILTIN_FUNCTIONS, BUILTIN_CONSTANTS, CONSTANT_VALUES,
  ALL_TYPES, PROCESSOR_FUNCTIONS,
} from '../data';
import type { BuiltinVariable, BuiltinFunction } from '../data/types';
import { scanHints, HintScanResult, IncludeInfo, HintDef } from './hint-scanner';
import { loc } from '../loc';

// ─── 符号定义 ───

export enum SymbolKind {
  Variable,
  Constant,
  Uniform,
  Varying,
  Parameter,
  Function,
  Struct,
  StructMember,
  BuiltinVar,
  BuiltinFunction,
  BuiltinConstant,
  /** 通过 #gdshader-hint-declare 注入的符号 */
  HintDefined,
}

export interface SymbolInfo {
  /** 符号名称 */
  name: string;
  /** 符号种类 */
  kind: SymbolKind;
  /** 类型字符串 (如 'vec3', 'float', 'mat4') */
  typeName: string;
  /** 声明位置 (内置符号没有) */
  declRange?: TokenRange;
  /** 声明所在行 */
  declLine?: number;
  /** 声明所在列 */
  declColumn?: number;
  /** 是否为 const */
  isConst?: boolean;
  /** 访问模式 (内置变量) */
  access?: 'in' | 'out' | 'inout';
  /** 描述 (内置符号的文档) */
  description?: string;
  /** 函数签名 (仅函数符号) */
  signature?: string;
  /** 函数参数 (仅函数符号) */
  parameters?: ParameterInfo[];
  /** struct 成员 (仅 struct 符号) */
  members?: StructMemberInfo[];
  /** 数组大小表达式存在 */
  isArray?: boolean;
  /** 关联的 AST 节点 */
  node?: ASTNode;
  /** 来源文件 URI (来自 #include 的符号) */
  sourceUri?: string;
}

export interface ParameterInfo {
  name: string;
  typeName: string;
  qualifier: string; // 'in' | 'out' | 'inout' | ''
}

export interface StructMemberInfo {
  name: string;
  typeName: string;
  isArray?: boolean;
  /** 声明所在行 */
  declLine?: number;
  /** 声明所在列 */
  declColumn?: number;
  /** 行尾注释 */
  comment?: string;
  /** 来源文件 URI (来自 #include 的 struct) */
  sourceUri?: string;
}

// ─── 作用域 ───

export class Scope {
  /** 父作用域 */
  readonly parent: Scope | null;
  /** 子作用域列表 */
  readonly children: Scope[] = [];
  /** 本作用域内声明的符号 */
  readonly symbols = new Map<string, SymbolInfo>();
  /** 作用域类型 */
  readonly scopeKind: 'global' | 'function' | 'block' | 'for-init';
  /** 作用域的行范围 (用于位置查询) */
  startLine: number;
  endLine: number;

  constructor(parent: Scope | null, scopeKind: 'global' | 'function' | 'block' | 'for-init', startLine = 0, endLine = Infinity) {
    this.parent = parent;
    this.scopeKind = scopeKind;
    this.startLine = startLine;
    this.endLine = endLine;
    if (parent) parent.children.push(this);
  }

  /** 在本作用域中声明符号 */
  declare(symbol: SymbolInfo): void {
    this.symbols.set(symbol.name, symbol);
  }

  /** 在本作用域中查找符号 (不向上查找) */
  lookupLocal(name: string): SymbolInfo | undefined {
    return this.symbols.get(name);
  }

  /** 沿作用域链向上查找符号 */
  resolve(name: string): SymbolInfo | undefined {
    const local = this.symbols.get(name);
    if (local) return local;
    return this.parent?.resolve(name);
  }

  /** 收集当前位置可见的所有符号 */
  getVisibleSymbols(): Map<string, SymbolInfo> {
    const result = new Map<string, SymbolInfo>();
    // 从最外层开始, 内层覆盖外层 (shadowing)
    this.collectSymbolsUp(result);
    return result;
  }

  private collectSymbolsUp(result: Map<string, SymbolInfo>): void {
    if (this.parent) this.parent.collectSymbolsUp(result);
    for (const [name, sym] of this.symbols) {
      result.set(name, sym);
    }
  }
}

// ─── 语义诊断 ───

export interface SemanticDiagnostic {
  line: number;
  column: number;
  length: number;
  message: string;
  severity: 'error' | 'warning' | 'hint';
}

// ─── 分析结果 ───

export interface AnalysisResult {
  /** 全局作用域 (根) */
  globalScope: Scope;
  /** 语义诊断 */
  diagnostics: SemanticDiagnostic[];
  /** 所有 struct 定义 (名称 -> 成员列表) */
  structs: Map<string, StructMemberInfo[]>;
  /** 所有函数定义 (名称 -> 符号信息) */
  functions: Map<string, SymbolInfo>;
  /** Hint 扫描结果 */
  hints: HintScanResult;
  /** 是否存在未 ignored 的 res:// include (此时禁用未定义标识符检查) */
  hasUnresolvedResIncludes: boolean;
}

// ─── 分析器 ───

export class Analyzer {
  private globalScope!: Scope;
  private currentScope!: Scope;
  private diagnostics: SemanticDiagnostic[] = [];
  private structs = new Map<string, StructMemberInfo[]>();
  private functions = new Map<string, SymbolInfo>();
  private shaderType = 'spatial';
  /** 是否禁用未定义标识符检查 (存在未 ignored 的 res:// include) */
  private suppressUndefinedCheck = false;
  /** Hint 扫描结果 */
  private hintResult!: HintScanResult;
  /** 原始源码行 (用于提取注释) */
  private sourceLines: string[] = [];

  /**
   * 分析 AST, 构建符号表和作用域树.
   * @param ast 语法树
   * @param source 原始源码 (用于扫描 hint 注释)
   * @param externalSymbols 外部导入的符号 (来自 #include 文件), 在语义分析前注入
   */
  analyze(ast: ShaderFileNode, source?: string, externalSymbols?: Map<string, SymbolInfo>): AnalysisResult {
    this.globalScope = new Scope(null, 'global');
    this.currentScope = this.globalScope;
    this.diagnostics = [];
    this.structs = new Map();
    this.functions = new Map();
    this.shaderType = ast.shaderType?.typeName.value ?? 'spatial';
    this.sourceLines = source ? source.split('\n') : [];

    // 扫描 hint 注释
    this.hintResult = source ? scanHints(source) : { includes: [], typeHints: [], defHints: [], hasUnresolvedResIncludes: false };
    this.suppressUndefinedCheck = this.hintResult.hasUnresolvedResIncludes;

    // 注入内置常量
    this.injectBuiltinConstants();

    // 注入内置函数
    this.injectBuiltinFunctions();

    // 注入外部导入的符号 (来自 #include), 在用户声明和未定义检查之前
    if (externalSymbols) {
      this.injectExternalSymbols(externalSymbols);
    }

    // 注入全局 hint-def 符号 (行号在任意函数体之外的)
    this.injectGlobalHintDefs();

    // 第一轮: 收集顶层声明 (struct/函数 先注册名称, 使前向引用成立)
    this.collectTopLevelNames(ast);

    // 第二轮: 完整分析
    for (const decl of ast.declarations) {
      this.analyzeTopLevelDecl(decl);
    }

    return {
      globalScope: this.globalScope,
      diagnostics: this.diagnostics,
      structs: this.structs,
      functions: this.functions,
      hints: this.hintResult,
      hasUnresolvedResIncludes: this.suppressUndefinedCheck,
    };
  }

  /** 注入外部导入的符号到全局作用域 */
  private injectExternalSymbols(symbols: Map<string, SymbolInfo>): void {
    for (const [name, sym] of symbols) {
      // 不覆盖已有的内置符号
      if (this.globalScope.lookupLocal(name)) continue;
      this.globalScope.declare(sym);
      // 同步 struct 信息
      if (sym.kind === SymbolKind.Struct && sym.members) {
        this.structs.set(name, sym.members);
      }
      // 同步函数信息
      if (sym.kind === SymbolKind.Function) {
        this.functions.set(name, sym);
      }
    }
  }

  /** 注入全局级别的 hint-def 符号 */
  private injectGlobalHintDefs(): void {
    for (const def of this.hintResult.defHints) {
      this.injectHintDef(def, this.globalScope);
    }
  }

  /** 向指定作用域注入 hint-def 符号 */
  private injectHintDef(def: HintDef, scope: Scope): void {
    if (def.isFunction) {
      scope.declare({
        name: def.name,
        kind: SymbolKind.HintDefined,
        typeName: def.typeName,
        signature: def.signature,
        parameters: def.parameters?.map(p => ({
          name: p.name,
          typeName: p.typeName,
          qualifier: p.qualifier,
        })),
        description: loc('analyzer.hintDeclare'),
      });
    } else {
      scope.declare({
        name: def.name,
        kind: SymbolKind.HintDefined,
        typeName: def.typeName,
        description: loc('analyzer.hintDeclare'),
      });
    }
  }

  // ═══════════════════════════════════════════
  // 内置符号注入
  // ═══════════════════════════════════════════

  private injectBuiltinConstants(): void {
    for (const c of BUILTIN_CONSTANTS) {
      this.globalScope.declare({
        name: c,
        kind: SymbolKind.BuiltinConstant,
        typeName: typeof CONSTANT_VALUES[c] === 'number'
          ? (Number.isInteger(CONSTANT_VALUES[c]) ? 'int' : 'float')
          : 'float',
        isConst: true,
        description: loc('analyzer.builtinConstant', c, CONSTANT_VALUES[c] ?? ''),
      });
    }
  }

  private injectBuiltinFunctions(): void {
    for (const fn of BUILTIN_FUNCTIONS) {
      this.globalScope.declare({
        name: fn.name,
        kind: SymbolKind.BuiltinFunction,
        typeName: this.extractReturnType(fn.signature),
        signature: fn.signature,
        description: fn.description,
      });
    }
  }

  /** 向函数作用域注入内置变量 */
  private injectBuiltinVars(scope: Scope, fnName: string): void {
    const vars: BuiltinVariable[] | undefined = BUILTIN_VARS[this.shaderType]?.[fnName];
    if (!vars) return;
    for (const v of vars) {
      scope.declare({
        name: v.name,
        kind: SymbolKind.BuiltinVar,
        typeName: v.type,
        access: v.access,
        description: v.description,
      });
    }
  }

  private extractReturnType(signature: string): string {
    // "float sin(float x)" -> "float"
    const parts = signature.trim().split(/\s+/);
    return parts[0] || 'void';
  }

  // ═══════════════════════════════════════════
  // 第一轮: 收集顶层名称 (前向引用)
  // ═══════════════════════════════════════════

  private collectTopLevelNames(ast: ShaderFileNode): void {
    for (const decl of ast.declarations) {
      switch (decl.kind) {
        case NodeKind.StructDecl: {
          const existing = this.globalScope.lookupLocal(decl.name.value);
          if (existing) break; // 第二轮再报重复
          const members: StructMemberInfo[] = decl.members.map(m => ({
            name: m.name.value,
            typeName: m.type.typeName.value,
            isArray: m.arraySize !== null,
            declLine: m.name.line,
            declColumn: m.name.column,
            comment: this.extractLineTrailingComment(m.name.line),
          }));
          this.structs.set(decl.name.value, members);
          this.globalScope.declare({
            name: decl.name.value,
            kind: SymbolKind.Struct,
            typeName: decl.name.value,
            declRange: decl.range,
            declLine: decl.name.line,
            declColumn: decl.name.column,
            members,
            node: decl,
          });
          break;
        }
        case NodeKind.FunctionDecl: {
          const existing = this.globalScope.lookupLocal(decl.name.value);
          if (existing) break;
          const params: ParameterInfo[] = decl.parameters.map(p => ({
            name: p.name.value,
            typeName: p.type.typeName.value,
            qualifier: p.qualifiers.map(q => q.value).join(' '),
          }));
          const sig = this.buildFunctionSignature(decl);
          const docComment = this.extractDocComment(decl.name.line);
          const sym: SymbolInfo = {
            name: decl.name.value,
            kind: SymbolKind.Function,
            typeName: decl.returnType.typeName.value,
            declRange: decl.range,
            declLine: decl.name.line,
            declColumn: decl.name.column,
            signature: sig,
            parameters: params,
            description: docComment ?? undefined,
            node: decl,
          };
          this.globalScope.declare(sym);
          this.functions.set(decl.name.value, sym);
          break;
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  // 第二轮: 完整分析
  // ═══════════════════════════════════════════

  private analyzeTopLevelDecl(decl: TopLevelDecl): void {
    switch (decl.kind) {
      case NodeKind.UniformDecl:
        this.analyzeUniformDecl(decl);
        break;
      case NodeKind.VaryingDecl:
        this.analyzeVaryingDecl(decl);
        break;
      case NodeKind.VariableDecl:
        this.analyzeVariableDecl(decl, true);
        break;
      case NodeKind.StructDecl:
        this.checkStructDuplicate(decl);
        break;
      case NodeKind.FunctionDecl:
        this.analyzeFunctionDecl(decl);
        break;
    }
  }

  private analyzeUniformDecl(decl: UniformDeclNode): void {
    const name = decl.name.value;
    const existing = this.findUserDeclConflict(name, decl.name);
    if (!existing) {
      this.globalScope.declare({
        name,
        kind: SymbolKind.Uniform,
        typeName: decl.type.typeName.value,
        declRange: decl.range,
        declLine: decl.name.line,
        declColumn: decl.name.column,
        isArray: decl.arraySize !== null,
        node: decl,
      });
    }
  }

  private analyzeVaryingDecl(decl: VaryingDeclNode): void {
    const name = decl.name.value;
    const existing = this.findUserDeclConflict(name, decl.name);
    if (!existing) {
      this.globalScope.declare({
        name,
        kind: SymbolKind.Varying,
        typeName: decl.type.typeName.value,
        declRange: decl.range,
        declLine: decl.name.line,
        declColumn: decl.name.column,
        isArray: decl.arraySize !== null,
        node: decl,
      });
    }
  }

  private analyzeVariableDecl(decl: VariableDeclNode, isGlobal: boolean): void {
    const name = decl.name.value;
    // 1. 同一块内重复 → error
    const localExisting = this.currentScope.lookupLocal(name);
    if (localExisting && this.isUserDeclared(localExisting)) {
      this.addDiagnostic(decl.name, loc('analyzer.duplicateVar', name), 'error');
    } else {
      // 2. 检查是否遮蔽了同一函数内的参数或 for-init 变量 → warning
      if (!isGlobal) {
        const shadowed = this.lookupInEnclosingFunctionScope(name);
        if (shadowed && this.isUserDeclared(shadowed) &&
            (shadowed.kind === SymbolKind.Parameter)) {
          this.addDiagnostic(decl.name, loc('analyzer.shadowParam', name), 'warning');
        }
      }
      this.currentScope.declare({
        name,
        kind: decl.isConst ? SymbolKind.Constant : SymbolKind.Variable,
        typeName: decl.type.typeName.value,
        declRange: decl.range,
        declLine: decl.name.line,
        declColumn: decl.name.column,
        isConst: decl.isConst,
        isArray: decl.arraySize !== null,
        node: decl,
      });
    }

    // 分析初始化表达式中的引用
    if (decl.initializer) {
      this.analyzeExpression(decl.initializer);
      // 类型检查: 初始化值类型是否与声明类型兼容
      const declType = decl.type.typeName.value;
      const initType = this.inferExprType(decl.initializer);
      if (initType && !this.isTypeCompatible(declType, initType)) {
        this.addDiagnostic(decl.name, loc('analyzer.typeMismatch', initType, declType), 'error');
      }
    }
  }

  /**
   * 在当前函数作用域链中查找符号 (不穿过函数边界到全局).
   * 从当前 scope 的 parent 开始向上找, 用于 shadow 检测.
   */
  private lookupInEnclosingFunctionScope(name: string): SymbolInfo | undefined {
    let scope: Scope | null = this.currentScope.parent;
    while (scope) {
      const sym = scope.lookupLocal(name);
      if (sym) return sym;
      // 到达函数级 scope 时停止
      if (scope.scopeKind === 'function') break;
      scope = scope.parent;
    }
    return undefined;
  }

  private checkStructDuplicate(decl: StructDeclNode): void {
    // 第一轮已注册, 这里检查是否有同名的非-struct 符号冲突
    // (struct 与 struct 同名在第一轮就不会重复注册, 这里检查 struct 成员重复)
    const memberNames = new Set<string>();
    for (const m of decl.members) {
      if (memberNames.has(m.name.value)) {
        this.addDiagnostic(m.name, loc('analyzer.structMemberDuplicate', decl.name.value, m.name.value), 'error');
      }
      memberNames.add(m.name.value);
    }
  }

  private analyzeFunctionDecl(decl: FunctionDeclNode): void {
    // 检查重复 (非第一轮注册的那一个)
    const existing = this.functions.get(decl.name.value);
    if (existing && existing.node !== decl) {
      this.addDiagnostic(decl.name, loc('analyzer.funcDuplicate', decl.name.value), 'error');
      return;
    }

    if (!decl.body) return;

    // 创建函数作用域
    const fnScope = new Scope(this.globalScope, 'function', decl.range.start.line, decl.range.end.line);
    const prevScope = this.currentScope;
    this.currentScope = fnScope;

    // 注入内置变量 (仅处理器函数)
    if (decl.isProcessorFunction) {
      this.injectBuiltinVars(fnScope, decl.name.value);
    }

    // 注入参数
    for (const param of decl.parameters) {
      const pName = param.name.value;
      const existingParam = fnScope.lookupLocal(pName);
      if (existingParam && this.isUserDeclared(existingParam)) {
        this.addDiagnostic(param.name, loc('analyzer.paramDuplicate', pName), 'error');
      } else {
        fnScope.declare({
          name: pName,
          kind: SymbolKind.Parameter,
          typeName: param.type.typeName.value,
          declRange: param.range,
          declLine: param.name.line,
          declColumn: param.name.column,
          node: param,
        });
      }
    }

    // 分析函数体
    this.analyzeBlock(decl.body);

    this.currentScope = prevScope;
  }

  private analyzeBlock(block: BlockStmtNode): void {
    const blockScope = new Scope(this.currentScope, 'block', block.range.start.line, block.range.end.line);
    const prevScope = this.currentScope;
    this.currentScope = blockScope;

    for (const stmt of block.statements) {
      this.analyzeStatement(stmt);
    }

    this.currentScope = prevScope;
  }

  private analyzeStatement(stmt: Statement): void {
    switch (stmt.kind) {
      case NodeKind.VariableDecl:
        this.analyzeVariableDecl(stmt as VariableDeclNode, false);
        break;
      case NodeKind.BlockStmt:
        this.analyzeBlock(stmt as BlockStmtNode);
        break;
      case NodeKind.ExpressionStmt:
        this.analyzeExpression((stmt as any).expression);
        break;
      case NodeKind.IfStmt: {
        const ifStmt = stmt as any;
        if (ifStmt.condition) this.analyzeExpression(ifStmt.condition);
        if (ifStmt.thenBranch) this.analyzeStatementOrBlock(ifStmt.thenBranch);
        if (ifStmt.elseBranch) this.analyzeStatementOrBlock(ifStmt.elseBranch);
        break;
      }
      case NodeKind.ForStmt: {
        const forStmt = stmt as ForStmtNode;
        // for 有自己的 init 作用域
        const forScope = new Scope(this.currentScope, 'for-init', forStmt.range.start.line, forStmt.range.end.line);
        const prevScope = this.currentScope;
        this.currentScope = forScope;
        if (forStmt.init) this.analyzeStatement(forStmt.init);
        if (forStmt.condition) this.analyzeExpression(forStmt.condition);
        if (forStmt.update) this.analyzeExpression(forStmt.update);
        if (forStmt.body) this.analyzeStatementOrBlock(forStmt.body);
        this.currentScope = prevScope;
        break;
      }
      case NodeKind.WhileStmt: {
        const whileStmt = stmt as any;
        if (whileStmt.condition) this.analyzeExpression(whileStmt.condition);
        if (whileStmt.body) this.analyzeStatementOrBlock(whileStmt.body);
        break;
      }
      case NodeKind.DoWhileStmt: {
        const doStmt = stmt as any;
        if (doStmt.body) this.analyzeStatementOrBlock(doStmt.body);
        if (doStmt.condition) this.analyzeExpression(doStmt.condition);
        break;
      }
      case NodeKind.SwitchStmt: {
        const switchStmt = stmt as any;
        if (switchStmt.discriminant) this.analyzeExpression(switchStmt.discriminant);
        for (const c of switchStmt.cases ?? []) {
          if (c.value) this.analyzeExpression(c.value);
          for (const s of c.body ?? []) this.analyzeStatement(s);
        }
        break;
      }
      case NodeKind.ReturnStmt: {
        const retStmt = stmt as any;
        if (retStmt.value) this.analyzeExpression(retStmt.value);
        break;
      }
    }
  }

  private analyzeStatementOrBlock(stmt: Statement): void {
    if (stmt.kind === NodeKind.BlockStmt) {
      this.analyzeBlock(stmt as BlockStmtNode);
    } else {
      this.analyzeStatement(stmt);
    }
  }

  private analyzeExpression(expr: Expression): void {
    if (!expr) return;
    switch (expr.kind) {
      case NodeKind.IdentifierExpr: {
        const name = (expr as any).name.value;
        // 跳过类型名 (类型构造器如 vec3(...))
        if (ALL_TYPES.includes(name)) break;
        const sym = this.currentScope.resolve(name);
        if (!sym) {
          // 可能是 struct 类型作为构造器 — 不报错
          if (this.structs.has(name)) break;
          // 如果存在未解析的 res:// include, 不报未定义 (可能来自 include)
          if (this.suppressUndefinedCheck) break;
          this.addDiagnostic((expr as any).name, loc('analyzer.undefinedIdent', name), 'warning');
        }
        break;
      }
      case NodeKind.BinaryExpr: {
        const binExpr = expr as any;
        this.analyzeExpression(binExpr.left);
        this.analyzeExpression(binExpr.right);
        break;
      }
      case NodeKind.UnaryExpr:
        this.analyzeExpression((expr as any).operand);
        break;
      case NodeKind.TernaryExpr: {
        const ternary = expr as any;
        this.analyzeExpression(ternary.condition);
        this.analyzeExpression(ternary.consequent);
        this.analyzeExpression(ternary.alternate);
        break;
      }
      case NodeKind.CallExpr: {
        const call = expr as any;
        this.analyzeExpression(call.callee);
        for (const arg of call.args ?? []) this.analyzeExpression(arg);
        // 函数调用参数类型检查
        this.checkCallArgs(call);
        break;
      }
      case NodeKind.IndexExpr: {
        const idx = expr as any;
        this.analyzeExpression(idx.object);
        this.analyzeExpression(idx.index);
        break;
      }
      case NodeKind.MemberExpr:
        this.analyzeExpression((expr as any).object);
        break;
      case NodeKind.AssignExpr: {
        const assign = expr as any;
        this.analyzeExpression(assign.left);
        this.analyzeExpression(assign.right);
        // 类型检查: 仅对 = 赋值检查, compound 赋值 (+=/-= 等) 跳过
        if (assign.operator?.value === '=') {
          const leftType = this.inferExprType(assign.left);
          const rightType = this.inferExprType(assign.right);
          if (leftType && rightType && !this.isTypeCompatible(leftType, rightType)) {
            const token = assign.operator;
            if (token) {
              this.addDiagnostic(token, loc('analyzer.typeMismatch', rightType, leftType), 'error');
            }
          }
        }
        break;
      }
      case NodeKind.GroupExpr:
        this.analyzeExpression((expr as any).expression);
        break;
      case NodeKind.ArrayInitExpr:
        for (const el of (expr as any).elements ?? []) this.analyzeExpression(el);
        break;
    }
  }

  // ═══════════════════════════════════════════
  // 类型推导与检查
  // ═══════════════════════════════════════════

  /** 标量类型集合 */
  private static readonly SCALAR_SET = new Set(['bool', 'int', 'uint', 'float']);
  /** 向量/矩阵基础类型 → 标量类型映射 */
  private static readonly VEC_SCALAR: Record<string, string> = {
    vec2: 'float', vec3: 'float', vec4: 'float',
    ivec2: 'int', ivec3: 'int', ivec4: 'int',
    uvec2: 'uint', uvec3: 'uint', uvec4: 'uint',
    bvec2: 'bool', bvec3: 'bool', bvec4: 'bool',
    mat2: 'float', mat3: 'float', mat4: 'float',
  };

  /**
   * 推导表达式的类型. 返回类型字符串或 null (无法推导).
   * 只推导具体类型, 不处理泛型 T.
   */
  private inferExprType(expr: Expression): string | null {
    if (!expr) return null;
    switch (expr.kind) {
      case NodeKind.LiteralExpr: {
        const tok = (expr as any).token;
        switch (tok.type) {
          case TokenType.IntLiteral: return 'int';
          case TokenType.UintLiteral: return 'uint';
          case TokenType.FloatLiteral: return 'float';
          case TokenType.BoolLiteral: return 'bool';
          default: return null;
        }
      }
      case NodeKind.IdentifierExpr: {
        const name = (expr as any).name.value;
        if (ALL_TYPES.includes(name)) return name; // 类型构造器本身 (在 CallExpr 中处理)
        const sym = this.currentScope.resolve(name);
        if (sym) return sym.typeName;
        if (this.structs.has(name)) return name; // struct 构造器
        return null;
      }
      case NodeKind.CallExpr: {
        const call = expr as any;
        if (!call.callee || call.callee.kind !== NodeKind.IdentifierExpr) return null;
        const calleeName = call.callee.name.value;
        // 类型构造器: vec3(...) → vec3
        if (ALL_TYPES.includes(calleeName)) return calleeName;
        // struct 构造器: MyStruct(...) → MyStruct
        if (this.structs.has(calleeName)) return calleeName;
        // 函数调用: 返回函数的 returnType
        const fnSym = this.currentScope.resolve(calleeName);
        if (fnSym && (fnSym.kind === SymbolKind.Function || fnSym.kind === SymbolKind.BuiltinFunction || fnSym.kind === SymbolKind.HintDefined)) {
          const retType = fnSym.typeName;
          // 泛型返回类型 (T, vec, mat 等) 无法确定, 返回 null
          if (this.isGenericType(retType)) return null;
          return retType;
        }
        return null;
      }
      case NodeKind.MemberExpr: {
        const obj = (expr as any).object;
        const member = (expr as any).member.value;
        const objType = this.inferExprType(obj);
        if (!objType) return null;
        // struct 成员
        const members = this.structs.get(objType);
        if (members) {
          const m = members.find(m => m.name === member);
          return m ? m.typeName : null;
        }
        // swizzle
        if (Analyzer.VEC_SCALAR[objType] && /^[xyzwrgbastpq]{1,4}$/.test(member)) {
          const scalarType = Analyzer.VEC_SCALAR[objType];
          if (member.length === 1) return scalarType;
          const prefix = objType.replace(/\d+$/, '');
          return `${prefix}${member.length}`;
        }
        return null;
      }
      case NodeKind.IndexExpr: {
        const objType = this.inferExprType((expr as any).object);
        if (!objType) return null;
        // vec[i] → scalar, mat[i] → vec
        const scalar = Analyzer.VEC_SCALAR[objType];
        if (scalar) {
          if (objType.startsWith('mat')) {
            const dim = objType.charAt(3);
            return `vec${dim}`;
          }
          return scalar;
        }
        return null;
      }
      case NodeKind.UnaryExpr:
        return this.inferExprType((expr as any).operand);
      case NodeKind.BinaryExpr: {
        const op = (expr as any).operator?.value;
        // 比较运算符 → bool
        if (['==', '!=', '<', '>', '<=', '>='].includes(op)) return 'bool';
        // 逻辑运算符 → bool
        if (['&&', '||'].includes(op)) return 'bool';
        // 算术运算: 取更高维类型 (float * vec3 → vec3)
        const lt = this.inferExprType((expr as any).left);
        const rt = this.inferExprType((expr as any).right);
        return this.inferBinaryResultType(lt, rt);
      }
      case NodeKind.TernaryExpr:
        return this.inferExprType((expr as any).consequent);
      case NodeKind.GroupExpr:
        return this.inferExprType((expr as any).expression);
      case NodeKind.AssignExpr:
        return this.inferExprType((expr as any).left);
      default:
        return null;
    }
  }

  /**
   * 检查两个类型是否兼容.
   * GDShader 不支持隐式标量类型转换 (int → float 需要显式),
   * 但标量可以与同族向量运算 (float * vec3 = vec3).
   */
  private isTypeCompatible(expected: string, actual: string): boolean {
    if (expected === actual) return true;
    if (expected === 'void' || actual === 'void') return true;

    // 标量 ↔ 同族向量兼容 (用于赋值: vec3 = float 在构造时合法, 但直接赋值不合法)
    // 仅在运算上下文中才兼容, 赋值时要严格匹配
    // → 所以这里保持严格: 不同类型 = 不兼容
    return false;
  }

  /** 判断两个类型在运算中是否兼容 (更宽松: float * vec3 合法) */
  private isOpTypeCompatible(a: string, b: string): boolean {
    if (a === b) return true;
    // 标量和同族向量可以混合运算
    const scalarA = Analyzer.VEC_SCALAR[a];
    const scalarB = Analyzer.VEC_SCALAR[b];
    if (scalarA && b === scalarA) return true; // vec3 op float
    if (scalarB && a === scalarB) return true; // float op vec3
    if (scalarA && scalarB && scalarA === scalarB) return true; // vec3 op vec4 (同族)
    return false;
  }

  /** 推导二元运算结果类型 (取更高维的类型) */
  private inferBinaryResultType(leftType: string | null, rightType: string | null): string | null {
    if (!leftType || !rightType) return null; // 任一未知 → 无法推导
    if (leftType === rightType) return leftType;
    // 标量 × 向量/矩阵 → 向量/矩阵
    if (Analyzer.VEC_SCALAR[rightType] && !Analyzer.VEC_SCALAR[leftType]) return rightType;
    if (Analyzer.VEC_SCALAR[leftType] && !Analyzer.VEC_SCALAR[rightType]) return leftType;
    // mat × vec → vec (矩阵乘向量返回向量)
    if (leftType.startsWith('mat') && rightType.startsWith('vec')) return rightType;
    if (leftType.startsWith('vec') && rightType.startsWith('mat')) return leftType;
    // mat × vec (整型向量)
    if (leftType.startsWith('mat') && (rightType.startsWith('ivec') || rightType.startsWith('uvec'))) return rightType;
    // 两个向量/矩阵: 取左类型
    return leftType;
  }

  /** 检查函数调用参数 */
  private checkCallArgs(call: any): void {
    if (!call.callee || call.callee.kind !== NodeKind.IdentifierExpr) return;
    const fnName = call.callee.name.value;
    const args: Expression[] = call.args ?? [];

    // 跳过类型构造器 (vec3(1.0) 等, 参数数量灵活)
    if (ALL_TYPES.includes(fnName)) return;
    // 跳过 struct 构造器 (成员数量可变)
    if (this.structs.has(fnName)) return;

    // 查找函数符号
    const sym = this.currentScope.resolve(fnName);
    if (!sym) return;
    if (sym.kind !== SymbolKind.Function && sym.kind !== SymbolKind.HintDefined) return;
    if (!sym.parameters) return;

    // 参数数量检查
    if (args.length !== sym.parameters.length) {
      this.addDiagnostic(
        call.callee.name,
        loc('analyzer.argCount', fnName, sym.parameters.length, args.length),
        'error'
      );
      return;
    }

    // 逐参数类型检查 (仅检查具体类型, 跳过泛型参数)
    for (let i = 0; i < sym.parameters.length; i++) {
      const paramType = sym.parameters[i].typeName;
      // 跳过泛型类型标记 (单个大写字母如 T, mat, vec 等)
      if (this.isGenericType(paramType)) continue;
      const argType = this.inferExprType(args[i]);
      if (argType && !this.isTypeCompatible(paramType, argType)) {
        const argToken = this.getExprToken(args[i]);
        if (argToken) {
          this.addDiagnostic(
            argToken,
            loc('analyzer.argTypeMismatch', sym.parameters[i].name, paramType, argType),
            'error'
          );
        }
      }
    }
  }

  /** 判断是否为泛型类型占位符 (如 T, genType, mat, vec, bvec, any) */
  private isGenericType(typeName: string): boolean {
    // 单个大写字母, 或 genType 等占位符, 或不在已知类型列表中的短标识符
    if (/^[A-Z]$/.test(typeName)) return true;
    if (['genType', 'genIType', 'genUType', 'genBType', 'mat', 'vec', 'bvec', 'ivec', 'uvec', 'any'].includes(typeName)) return true;
    return false;
  }

  /** 从表达式中获取一个代表性 token (用于诊断定位) */
  private getExprToken(expr: Expression): Token | null {
    if (!expr) return null;
    switch (expr.kind) {
      case NodeKind.IdentifierExpr: return (expr as any).name;
      case NodeKind.LiteralExpr: return (expr as any).token;
      case NodeKind.CallExpr: return this.getExprToken((expr as any).callee);
      case NodeKind.MemberExpr: return (expr as any).member;
      case NodeKind.IndexExpr: return this.getExprToken((expr as any).object);
      case NodeKind.UnaryExpr: return (expr as any).operator;
      case NodeKind.BinaryExpr: return (expr as any).operator;
      case NodeKind.GroupExpr: return this.getExprToken((expr as any).expression);
      default: return null;
    }
  }

  // ═══════════════════════════════════════════
  // 辅助
  // ═══════════════════════════════════════════

  /** 检查用户声明冲突 (忽略内置符号遮蔽) */
  private findUserDeclConflict(name: string, token: Token): boolean {
    const existing = this.globalScope.lookupLocal(name);
    if (existing && this.isUserDeclared(existing)) {
      this.addDiagnostic(token, loc('analyzer.duplicateDecl', name), 'error');
      return true;
    }
    return false;
  }

  private isUserDeclared(sym: SymbolInfo): boolean {
    return sym.kind !== SymbolKind.BuiltinVar &&
           sym.kind !== SymbolKind.BuiltinFunction &&
           sym.kind !== SymbolKind.BuiltinConstant &&
           sym.kind !== SymbolKind.HintDefined;
  }

  private addDiagnostic(token: Token, message: string, severity: 'error' | 'warning' | 'hint'): void {
    this.diagnostics.push({
      line: token.line,
      column: token.column,
      length: token.length,
      message,
      severity,
    });
  }

  private buildFunctionSignature(decl: FunctionDeclNode): string {
    const params = decl.parameters.map(p => {
      const quals = p.qualifiers.map(q => q.value).join(' ');
      return `${quals ? quals + ' ' : ''}${p.type.typeName.value} ${p.name.value}`;
    }).join(', ');
    return `${decl.returnType.typeName.value} ${decl.name.value}(${params})`;
  }

  /** 从源码行中提取行尾注释 (// 之后的内容), 排除 #gdshader-hint-* */
  private extractLineTrailingComment(line: number): string | undefined {
    if (line < 0 || line >= this.sourceLines.length) return undefined;
    const text = this.sourceLines[line];
    const match = text.match(/\/\/(.*)$/);
    if (!match) return undefined;
    let comment = match[1].trim();
    comment = comment.replace(/#gdshader-hint-\S*/g, '').trim();
    return comment || undefined;
  }

  /**
   * 提取函数声明之前连续的 /// 文档注释.
   * 返回格式化的注释文本, 或 null.
   */
  private extractDocComment(declLine: number): string | null {
    const lines: string[] = [];
    // 函数声明可能在返回类型行, 向上查找 ///
    let i = declLine - 1;
    while (i >= 0 && i < this.sourceLines.length) {
      const text = this.sourceLines[i].trim();
      const tripleMatch = text.match(/^\/\/\/\s?(.*)/);
      if (tripleMatch) {
        lines.unshift(tripleMatch[1]);
        i--;
      } else {
        break;
      }
    }
    if (lines.length === 0) return null;
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════
  // 静态查询方法
  // ═══════════════════════════════════════════

  /**
   * 在分析结果中, 根据行号查找包含该行的最内层作用域.
   */
  static findScopeAtLine(scope: Scope, line: number): Scope {
    for (const child of scope.children) {
      if (line >= child.startLine && line <= child.endLine) {
        return Analyzer.findScopeAtLine(child, line);
      }
    }
    return scope;
  }

  /**
   * 获取指定位置可见的所有符号.
   */
  static getVisibleSymbolsAtLine(globalScope: Scope, line: number): Map<string, SymbolInfo> {
    const scope = Analyzer.findScopeAtLine(globalScope, line);
    return scope.getVisibleSymbols();
  }

  /**
   * 解析标识符: 在指定位置查找符号定义.
   */
  static resolveAtLine(globalScope: Scope, name: string, line: number): SymbolInfo | undefined {
    const scope = Analyzer.findScopeAtLine(globalScope, line);
    return scope.resolve(name);
  }
}
