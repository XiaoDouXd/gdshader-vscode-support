# AST 设计文档

本文档定义 GDShader 语法树(AST)的设计方案, 包括词法分析器(Lexer), 语法分析器(Parser)的架构, AST 节点类型, 以及与现有 provider 的集成策略.

## 1. 目标

- 为 GDShader 源代码建立完整的结构化表示
- 支持**容错解析**: 代码不完整或有错误时仍能产出部分 AST
- 为 provider 层提供统一的查询接口, 替代当前的正则匹配
- 为未来的高级功能(类型推断, go-to-definition, rename, 引用查找)奠定基础
- 维持编辑器级别的性能: 增量更新, 按需解析

## 2. 架构总览

```
源代码 (.gdshader / .gdshaderinc)
  │
  ▼
┌──────────────────┐
│  Preprocessor    │  处理 #include, #define, #ifdef 等
│  (Phase 0)       │  产出: 展开后的源文本 + 源映射
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Lexer           │  将源文本切分为 Token 流
│  (Phase 1)       │  产出: Token[]
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Parser          │  递归下降解析器
│  (Phase 2)       │  产出: AST (ShaderFile 根节点)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Analyzer        │  语义分析: 符号表, 类型检查, 作用域
│  (Phase 3)       │  产出: 标注后的 AST + 诊断信息
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  DocumentCache   │  per-document 缓存, 文档变更时增量更新
│                  │  Provider 通过此层查询 AST
└──────────────────┘
```

### 文件组织

```
src/
├── parser/
│   ├── token.ts          # Token 类型定义
│   ├── lexer.ts          # 词法分析器
│   ├── ast.ts            # AST 节点类型定义
│   ├── parser.ts         # 递归下降解析器
│   ├── preprocessor.ts   # 预处理器 (Phase 0, 可选/渐进)
│   ├── analyzer.ts       # 语义分析器 (Phase 3, 渐进)
│   ├── document-cache.ts # 文档缓存与增量更新
│   └── index.ts          # 统一导出
├── data/                 # 已有的数据表 (不变)
├── providers/            # 已有的 provider (改造为使用 AST)
└── ...
```

## 3. Phase 1: Token 定义

### 3.1 Token 结构

```typescript
interface Token {
  type: TokenType;
  value: string;       // 原始文本
  line: number;        // 0-based 行号
  column: number;      // 0-based 列号
  offset: number;      // 文件内偏移量
  length: number;      // token 长度
}

interface TokenRange {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}
```

### 3.2 TokenType 枚举

```typescript
enum TokenType {
  // ─── 字面量 ───
  IntLiteral,           // 42, 0xFF
  UintLiteral,          // 42u, 0xFFu
  FloatLiteral,         // 3.14, 1.0f, 1e-3
  BoolLiteral,          // true, false
  StringLiteral,        // "path/to/file" (仅用于 #include)

  // ─── 标识符与关键字 ───
  Identifier,           // 用户定义标识符
  // 关键字作为独立 token 类型:
  KwShaderType,         // shader_type
  KwRenderMode,         // render_mode
  KwUniform, KwVarying, KwConst, KwStruct,
  KwGroupUniforms,      // group_uniforms
  KwGlobal, KwInstance,
  KwFlat, KwSmooth,
  KwIn, KwOut, KwInout,
  KwLowp, KwMediump, KwHighp,
  KwIf, KwElse, KwFor, KwWhile, KwDo,
  KwSwitch, KwCase, KwDefault,
  KwBreak, KwContinue, KwReturn, KwDiscard,

  // 内置类型关键字:
  KwVoid, KwBool, KwInt, KwUint, KwFloat,
  KwVec2, KwVec3, KwVec4,
  KwBvec2, KwBvec3, KwBvec4,
  KwIvec2, KwIvec3, KwIvec4,
  KwUvec2, KwUvec3, KwUvec4,
  KwMat2, KwMat3, KwMat4,
  KwSampler2D, KwISampler2D, KwUSampler2D,
  KwSampler2DArray, KwISampler2DArray, KwUSampler2DArray,
  KwSampler3D, KwISampler3D, KwUSampler3D,
  KwSamplerCube, KwSamplerCubeArray, KwSamplerExternalOES,

  // ─── 运算符 (按优先级分组) ───
  // 赋值
  Assign,               // =
  PlusAssign,           // +=
  MinusAssign,          // -=
  StarAssign,           // *=
  SlashAssign,          // /=
  PercentAssign,        // %=
  LShiftAssign,         // <<=
  RShiftAssign,         // >>=
  AmpAssign,            // &=
  PipeAssign,           // |=
  CaretAssign,          // ^=
  // 比较
  EqualEqual,           // ==
  BangEqual,            // !=
  Less,                 // <
  LessEqual,            // <=
  Greater,              // >
  GreaterEqual,         // >=
  // 逻辑
  AmpAmp,              // &&
  PipePipe,            // ||
  Bang,                // !
  // 位运算
  Amp,                 // &
  Pipe,                // |
  Caret,               // ^
  Tilde,               // ~
  LShift,              // <<
  RShift,              // >>
  // 算术
  Plus,                // +
  Minus,               // -
  Star,                // *
  Slash,               // /
  Percent,             // %
  // 三元
  Question,            // ?
  Colon,               // :

  // ─── 标点 ───
  Semicolon,           // ;
  Comma,               // ,
  Dot,                 // .
  LParen,              // (
  RParen,              // )
  LBrace,              // {
  RBrace,              // }
  LBracket,            // [
  RBracket,            // ]

  // ─── 注释 ───
  LineComment,          // // ...
  BlockComment,         // /* ... */
  DocComment,           // /** ... */

  // ─── 预处理器 ───
  Preprocessor,         // #include, #define, #ifdef 等整行

  // ─── 特殊 ───
  Whitespace,           // 空白 (通常跳过, 但格式化需要)
  Newline,              // 换行
  EOF,                  // 文件结束
  Error,                // 无法识别的字符
}
```

### 3.3 关键字映射表

Lexer 先将所有 `[a-zA-Z_]\w*` 识别为 `Identifier`, 然后查表转换为对应的关键字 token:

```typescript
const KEYWORD_MAP: Record<string, TokenType> = {
  'shader_type': TokenType.KwShaderType,
  'render_mode': TokenType.KwRenderMode,
  'uniform': TokenType.KwUniform,
  'varying': TokenType.KwVarying,
  // ... 完整映射
};
```

## 4. Phase 2: AST 节点定义

### 4.1 基础节点

```typescript
/** 所有 AST 节点的基类 */
interface ASTNode {
  kind: NodeKind;
  range: TokenRange;     // 源码位置
  parent?: ASTNode;      // 父节点 (运行时设置)
}
```

### 4.2 NodeKind 枚举

```typescript
enum NodeKind {
  // ─── 顶层 ───
  ShaderFile,            // 根节点
  ShaderTypeDecl,        // shader_type spatial;
  RenderModeDecl,        // render_mode blend_mix, unshaded;
  GroupUniformsDecl,     // group_uniforms MyGroup;

  // ─── 声明 ───
  FunctionDecl,          // void vertex() { ... }
  ParameterDecl,         // in vec3 normal
  VariableDecl,          // float x = 1.0;
  UniformDecl,           // uniform float speed : hint_range(0, 1) = 0.5;
  VaryingDecl,           // varying vec3 color;
  ConstDecl,             // const float PI2 = 6.28;
  StructDecl,            // struct Light { ... };
  StructMember,          // vec3 position;

  // ─── 语句 ───
  BlockStmt,             // { ... }
  ExpressionStmt,        // expr;
  IfStmt,                // if (cond) { ... } else { ... }
  ForStmt,               // for (init; cond; step) { ... }
  WhileStmt,             // while (cond) { ... }
  DoWhileStmt,           // do { ... } while (cond);
  SwitchStmt,            // switch (expr) { ... }
  CaseClause,            // case 1:
  DefaultClause,         // default:
  ReturnStmt,            // return [expr];
  BreakStmt,             // break;
  ContinueStmt,          // continue;
  DiscardStmt,           // discard;

  // ─── 表达式 ───
  BinaryExpr,            // a + b
  UnaryExpr,             // -a, !a
  TernaryExpr,           // cond ? a : b
  CallExpr,              // func(args)
  ConstructorExpr,       // vec3(1.0, 0.0, 0.0)
  IndexExpr,             // arr[i]
  MemberExpr,            // obj.field
  SwizzleExpr,           // v.xyz
  AssignExpr,            // a = b, a += b
  IdentifierExpr,        // x
  LiteralExpr,           // 42, 3.14, true
  ArrayConstructorExpr,  // float[3](1.0, 2.0, 3.0) 或 { 1.0, 2.0, 3.0 }
  GroupExpr,             // (expr)

  // ─── 类型 ───
  TypeRef,               // vec3, MyStruct, float[3]

  // ─── 预处理器 ───
  PreprocessorDirective, // #define, #include, #ifdef 等

  // ─── 特殊 ───
  ErrorNode,             // 解析错误时的占位节点
}
```

### 4.3 关键节点详细定义

```typescript
// ─── 根节点 ───
interface ShaderFileNode extends ASTNode {
  kind: NodeKind.ShaderFile;
  shaderType: ShaderTypeDeclNode | null;
  renderMode: RenderModeDeclNode | null;
  declarations: Declaration[];  // uniform, varying, const, struct, function, group_uniforms
}

// ─── shader_type ───
interface ShaderTypeDeclNode extends ASTNode {
  kind: NodeKind.ShaderTypeDecl;
  typeName: Token;  // 'spatial' | 'canvas_item' | 'particles' | 'sky' | 'fog'
}

// ─── render_mode ───
interface RenderModeDeclNode extends ASTNode {
  kind: NodeKind.RenderModeDecl;
  modes: Token[];  // ['blend_mix', 'unshaded', ...]
}

// ─── 函数声明 ───
interface FunctionDeclNode extends ASTNode {
  kind: NodeKind.FunctionDecl;
  returnType: TypeRefNode;
  name: Token;
  parameters: ParameterDeclNode[];
  body: BlockStmtNode;
  isProcessorFunction: boolean;  // vertex/fragment/light/start/process/sky/fog
}

// ─── Uniform 声明 ───
interface UniformDeclNode extends ASTNode {
  kind: NodeKind.UniformDecl;
  qualifiers: Token[];   // ['global'] 或 ['instance'] 或 []
  type: TypeRefNode;
  name: Token;
  hints: UniformHint[];  // source_color, hint_range(0, 1), ...
  defaultValue: Expression | null;
}

interface UniformHint {
  name: Token;
  args: Expression[];    // hint_range(0, 1) -> args = [0, 1]
}

// ─── 变量声明 ───
interface VariableDeclNode extends ASTNode {
  kind: NodeKind.VariableDecl;
  isConst: boolean;
  precision: Token | null;   // lowp, mediump, highp
  type: TypeRefNode;
  name: Token;
  arraySize: Expression | null;  // 数组大小 (可选)
  initializer: Expression | null;
}

// ─── 类型引用 ───
interface TypeRefNode extends ASTNode {
  kind: NodeKind.TypeRef;
  typeName: Token;        // 'vec3', 'float', 'MyStruct'
  arraySize: Expression | null;  // float[3] -> arraySize = 3
}

// ─── 块语句 ───
interface BlockStmtNode extends ASTNode {
  kind: NodeKind.BlockStmt;
  statements: Statement[];
}

// ─── if 语句 ───
interface IfStmtNode extends ASTNode {
  kind: NodeKind.IfStmt;
  condition: Expression;
  thenBranch: Statement;
  elseBranch: Statement | null;
}

// ─── for 语句 ───
interface ForStmtNode extends ASTNode {
  kind: NodeKind.ForStmt;
  init: Statement | null;       // 可以是变量声明或表达式
  condition: Expression | null;
  update: Expression | null;
  body: Statement;
}

// ─── switch 语句 ───
interface SwitchStmtNode extends ASTNode {
  kind: NodeKind.SwitchStmt;
  discriminant: Expression;
  cases: (CaseClauseNode | DefaultClauseNode)[];
}

interface CaseClauseNode extends ASTNode {
  kind: NodeKind.CaseClause;
  value: Expression;
  body: Statement[];
}

// ─── 表达式 ───
interface BinaryExprNode extends ASTNode {
  kind: NodeKind.BinaryExpr;
  operator: Token;
  left: Expression;
  right: Expression;
}

interface CallExprNode extends ASTNode {
  kind: NodeKind.CallExpr;
  callee: Expression;     // 函数名或类型名
  args: Expression[];
}

interface MemberExprNode extends ASTNode {
  kind: NodeKind.MemberExpr;
  object: Expression;
  member: Token;
  isSwizzle: boolean;     // true: v.xyz, false: light.position
}

// ─── 错误恢复节点 ───
interface ErrorNode extends ASTNode {
  kind: NodeKind.ErrorNode;
  message: string;
  tokens: Token[];        // 跳过的 token
}
```

## 5. 语法产生式(简化 BNF)

```
ShaderFile
  = ShaderTypeDecl? RenderModeDecl? TopLevelDecl* EOF

ShaderTypeDecl
  = 'shader_type' IDENTIFIER ';'

RenderModeDecl
  = 'render_mode' IDENTIFIER (',' IDENTIFIER)* ';'

TopLevelDecl
  = UniformDecl | VaryingDecl | ConstDecl | StructDecl
  | FunctionDecl | GroupUniformsDecl | PreprocessorDirective

UniformDecl
  = ('global' | 'instance')? 'uniform' Type IDENTIFIER ('[' Expr ']')?
    (':' HintList)? ('=' Expr)? ';'

HintList
  = Hint (',' Hint)*

Hint
  = IDENTIFIER ('(' ExprList ')')?

VaryingDecl
  = ('flat' | 'smooth')? 'varying' Type IDENTIFIER ('[' Expr ']')? ';'

ConstDecl
  = 'const' Precision? Type IDENTIFIER ('[' Expr? ']')? '=' Expr
    (',' IDENTIFIER ('[' Expr? ']')? '=' Expr)* ';'

StructDecl
  = 'struct' IDENTIFIER '{' StructMember+ '}' ';'

StructMember
  = Type IDENTIFIER ('[' Expr ']')? ';'

FunctionDecl
  = Type IDENTIFIER '(' ParamList? ')' Block

ParamList
  = Param (',' Param)*

Param
  = ParamQualifier* Type IDENTIFIER

ParamQualifier
  = 'in' | 'out' | 'inout' | 'const'

GroupUniformsDecl
  = 'group_uniforms' (IDENTIFIER ('.' IDENTIFIER)*)? ';'

// ─── 语句 ───

Block
  = '{' Statement* '}'

Statement
  = Block | IfStmt | ForStmt | WhileStmt | DoWhileStmt | SwitchStmt
  | ReturnStmt | BreakStmt | ContinueStmt | DiscardStmt
  | VarDeclStmt | ExprStmt

IfStmt
  = 'if' '(' Expr ')' Statement ('else' Statement)?

ForStmt
  = 'for' '(' (VarDeclStmt | ExprStmt | ';') Expr? ';' Expr? ')' Statement

WhileStmt
  = 'while' '(' Expr ')' Statement

DoWhileStmt
  = 'do' Statement 'while' '(' Expr ')' ';'

SwitchStmt
  = 'switch' '(' Expr ')' '{' (CaseClause | DefaultClause)* '}'

CaseClause
  = 'case' Expr ':' Statement*

DefaultClause
  = 'default' ':' Statement*

ReturnStmt
  = 'return' Expr? ';'

DiscardStmt
  = 'discard' ';'

VarDeclStmt
  = 'const'? Precision? Type IDENTIFIER ('[' Expr? ']')?
    ('=' Expr)? (',' IDENTIFIER ('[' Expr? ']')? ('=' Expr)?)* ';'

ExprStmt
  = Expr ';'

// ─── 表达式 (按优先级, 低到高) ───

Expr
  = AssignExpr

AssignExpr
  = TernaryExpr (AssignOp AssignExpr)?

AssignOp
  = '=' | '+=' | '-=' | '*=' | '/=' | '%=' | '<<=' | '>>=' | '&=' | '|=' | '^='

TernaryExpr
  = LogicOrExpr ('?' Expr ':' TernaryExpr)?

LogicOrExpr
  = LogicAndExpr ('||' LogicAndExpr)*

LogicAndExpr
  = BitwiseOrExpr ('&&' BitwiseOrExpr)*

BitwiseOrExpr
  = BitwiseXorExpr ('|' BitwiseXorExpr)*

BitwiseXorExpr
  = BitwiseAndExpr ('^' BitwiseAndExpr)*

BitwiseAndExpr
  = EqualityExpr ('&' EqualityExpr)*

EqualityExpr
  = RelationalExpr (('==' | '!=') RelationalExpr)*

RelationalExpr
  = ShiftExpr (('<' | '>' | '<=' | '>=') ShiftExpr)*

ShiftExpr
  = AdditiveExpr (('<<' | '>>') AdditiveExpr)*

AdditiveExpr
  = MultiplicativeExpr (('+' | '-') MultiplicativeExpr)*

MultiplicativeExpr
  = UnaryExpr (('*' | '/' | '%') UnaryExpr)*

UnaryExpr
  = ('+' | '-' | '!' | '~') UnaryExpr
  | PostfixExpr

PostfixExpr
  = PrimaryExpr (
      '.' IDENTIFIER           // 成员访问/swizzle
    | '[' Expr ']'             // 数组下标
    | '(' ExprList? ')'        // 函数调用
    | '++' | '--'              // 自增自减 (GDShader 不支持, 但可作为 ErrorNode)
    )*

PrimaryExpr
  = IDENTIFIER
  | IntLiteral | UintLiteral | FloatLiteral | BoolLiteral
  | TypeConstructor             // vec3(1.0), float[3](...)
  | '(' Expr ')'               // 分组
  | '{' ExprList '}'           // 数组初始化

TypeConstructor
  = TypeName ('(' ExprList? ')')
  | TypeName '[' Expr? ']' '(' ExprList? ')'

ExprList
  = Expr (',' Expr)*
```

## 6. 容错解析策略

GDShader 编辑器必须在代码不完整时仍然工作. 关键策略:

### 6.1 同步点(Synchronization Points)

当解析出错时, 跳过 token 直到遇到同步点:
- **顶层同步**: `shader_type`, `render_mode`, `uniform`, `varying`, `const`, `struct`, `void`, 类型关键字 + 标识符 + `(` (函数定义)
- **语句级同步**: `;`, `}`, `{`, 以及语句起始关键字 (`if`, `for`, `while`, `return`, ...)
- **表达式级同步**: `)`, `,`, `;`

### 6.2 ErrorNode

每次错误恢复产生一个 `ErrorNode`, 包含:
- 错误信息
- 被跳过的 token 列表
- 最佳猜测的 range

### 6.3 部分节点

允许某些节点的子节点为 `null`:
- `IfStmtNode.condition` 可以为 `null` (用户正在输入)
- `FunctionDeclNode.body` 可以为 `null` (函数体未写完)
- `VariableDeclNode.type` 可以为 `null` (类型未写完)

## 7. Phase 3: 语义分析(渐进实现)

### 7.1 符号表

```typescript
interface Symbol {
  name: string;
  kind: 'variable' | 'function' | 'struct' | 'uniform' | 'varying' | 'const' | 'parameter' | 'builtin';
  type: TypeInfo;
  declNode: ASTNode;
  scope: Scope;
  access?: 'in' | 'out' | 'inout';
}

interface Scope {
  parent: Scope | null;
  symbols: Map<string, Symbol[]>;  // 支持重载
  kind: 'global' | 'function' | 'block' | 'for';
}
```

### 7.2 分析 Pass

1. **收集声明**: 遍历顶层, 注册所有 struct/uniform/varying/const/函数
2. **注入内置符号**: 根据 shader_type + 处理器函数, 注入 BUILTIN_VARS 和 BUILTIN_FUNCTIONS
3. **类型检查**: 遍历函数体, 检查:
   - 变量使用前是否声明
   - 类型是否匹配(不含隐式转换)
   - 函数调用参数是否匹配
   - 只读变量的写入
   - discard 的作用域
   - varying 的赋值作用域

### 7.3 优先级(分阶段实现)

| 阶段 | 内容 | 解锁能力 |
|---|---|---|
| P0 | Lexer + Parser, 基本 AST | 准确的作用域检测, 替代正则 |
| P1 | 符号表 + 作用域 | go-to-definition, 未定义变量检测 |
| P2 | 内置变量/函数注入 | 精确的补全和悬停提示 |
| P3 | 基本类型检查 | 类型不匹配诊断, 只读写入检查 |
| P4 | 完整类型推断 | 表达式类型推导, 函数重载解析 |

## 8. DocumentCache 与增量更新

### 8.1 缓存结构

```typescript
interface DocumentState {
  version: number;           // 文档版本号
  tokens: Token[];           // 词法分析结果
  ast: ShaderFileNode;       // 语法分析结果
  symbols: SymbolTable;      // 符号表 (P1+)
  diagnostics: Diagnostic[]; // 来自 parser/analyzer 的诊断
}

class DocumentCache {
  private cache: Map<string, DocumentState>;  // uri -> state

  /** 文档变更时调用 */
  update(uri: string, text: string, version: number): DocumentState;

  /** 获取指定位置所在的 AST 节点 */
  getNodeAtPosition(uri: string, position: Position): ASTNode | null;

  /** 获取指定位置所在的作用域 */
  getScopeAtPosition(uri: string, position: Position): Scope | null;

  /** 获取指定位置可用的符号列表 */
  getVisibleSymbols(uri: string, position: Position): Symbol[];
}
```

### 8.2 增量策略

初期实现全量重解析(GDShader 文件通常不大, <1000 行, 全量解析应在 <5ms 完成). 后续可按需优化:
- 脏区间检测: 只重新 lex 变化的行
- 增量解析: 只重新 parse 受影响的顶层声明

## 9. 与 Provider 的集成

### 9.1 补全 (CompletionProvider)

```
旧: 正则匹配 linePrefix -> 决定补全类型
新: getNodeAtPosition(cursor) -> 判断 AST 上下文 -> 精确补全
```

例如:
- 光标在 `FunctionDecl(name=fragment).body` 内 -> 提供 fragment 内置变量
- 光标在 `UniformDecl` 的 `:` 之后 -> 提供 uniform hints
- 光标在 `.` 之后 -> 判断左侧表达式类型, 决定 swizzle/成员补全

### 9.2 悬停 (HoverProvider)

```
旧: 正则取单词 -> 在数据表中查找
新: getNodeAtPosition(cursor) -> 查符号表 -> 精确类型/文档信息
```

### 9.3 诊断 (DiagnosticsProvider)

```
旧: 正则逐行检查
新: parser.diagnostics + analyzer.diagnostics -> 合并输出
```

Parser 产出的诊断: 语法错误, 括号不匹配, 缺少分号...
Analyzer 产出的诊断: 未定义变量, 类型不匹配, 只读写入, discard 位置, varying 赋值位置...

### 9.4 格式化 (FormattingProvider)

不直接使用 AST, 但可利用 Token 流改进缩进计算. Lexer 产出的 Token 流天然正确处理注释/字符串内容, 不再需要手动 stripComments.

## 10. 预处理器处理策略

预处理器 (#define, #ifdef, #include) 增加了显著的复杂度. 采用**渐进策略**:

### Phase 0 (初始): 预处理行作为原子

- Lexer 将以 `#` 开头的行识别为 `Preprocessor` token
- Parser 将其包装为 `PreprocessorDirective` 节点
- 不展开 #define, 不处理 #ifdef 条件
- 与 TMLanguage 语法高亮保持一致

### Phase 0.5 (中期): 基本条件编译

- 识别 #ifdef/#ifndef/#if/#else/#elif/#endif 结构
- 在 AST 中标记条件分支
- 不展开 #define 宏

### Phase 1 (远期): 完整预处理

- 实现宏展开
- 处理 #include (需要文件系统访问)
- 维护源映射(展开后位置 -> 原始位置)

