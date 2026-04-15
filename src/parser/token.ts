/**
 * GDShader Token 类型定义
 * 词法分析器产出的 token 结构和所有 token 类型.
 */

// ─── Token 位置 ───

export interface TokenPos {
  line: number;     // 0-based
  column: number;   // 0-based
  offset: number;   // 文件内字节偏移
}

export interface TokenRange {
  start: TokenPos;
  end: TokenPos;
}

// ─── Token 结构 ───

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  offset: number;
  length: number;
}

/** 创建一个 TokenRange */
export function tokenRange(start: Token, end: Token): TokenRange {
  return {
    start: { line: start.line, column: start.column, offset: start.offset },
    end: { line: end.line, column: end.column + end.length, offset: end.offset + end.length },
  };
}

/** 从单个 token 创建 range */
export function tokenToRange(t: Token): TokenRange {
  return tokenRange(t, t);
}

// ─── TokenType 枚举 ───

export enum TokenType {
  // ── 字面量 ──
  IntLiteral,
  UintLiteral,
  FloatLiteral,
  BoolLiteral,
  StringLiteral,

  // ── 标识符 ──
  Identifier,

  // ── 语言关键字 ──
  KwShaderType,
  KwRenderMode,
  KwUniform,
  KwVarying,
  KwConst,
  KwStruct,
  KwGroupUniforms,
  KwGlobal,
  KwInstance,
  KwFlat,
  KwSmooth,
  KwIn,
  KwOut,
  KwInout,
  KwLowp,
  KwMediump,
  KwHighp,
  KwIf,
  KwElse,
  KwFor,
  KwWhile,
  KwDo,
  KwSwitch,
  KwCase,
  KwDefault,
  KwBreak,
  KwContinue,
  KwReturn,
  KwDiscard,
  KwTrue,
  KwFalse,

  // ── 内置类型关键字 ──
  KwVoid,
  KwBool,
  KwInt,
  KwUint,
  KwFloat,
  KwVec2,
  KwVec3,
  KwVec4,
  KwBvec2,
  KwBvec3,
  KwBvec4,
  KwIvec2,
  KwIvec3,
  KwIvec4,
  KwUvec2,
  KwUvec3,
  KwUvec4,
  KwMat2,
  KwMat3,
  KwMat4,
  KwSampler2D,
  KwISampler2D,
  KwUSampler2D,
  KwSampler2DArray,
  KwISampler2DArray,
  KwUSampler2DArray,
  KwSampler3D,
  KwISampler3D,
  KwUSampler3D,
  KwSamplerCube,
  KwSamplerCubeArray,
  KwSamplerExternalOES,

  // ── 赋值运算符 ──
  Assign,           // =
  PlusAssign,       // +=
  MinusAssign,      // -=
  StarAssign,       // *=
  SlashAssign,      // /=
  PercentAssign,    // %=
  LShiftAssign,     // <<=
  RShiftAssign,     // >>=
  AmpAssign,        // &=
  PipeAssign,       // |=
  CaretAssign,      // ^=

  // ── 比较运算符 ──
  EqualEqual,       // ==
  BangEqual,        // !=
  Less,             // <
  LessEqual,        // <=
  Greater,          // >
  GreaterEqual,     // >=

  // ── 逻辑运算符 ──
  AmpAmp,           // &&
  PipePipe,         // ||
  Bang,             // !

  // ── 位运算符 ──
  Amp,              // &
  Pipe,             // |
  Caret,            // ^
  Tilde,            // ~
  LShift,           // <<
  RShift,           // >>

  // ── 算术运算符 ──
  Plus,             // +
  Minus,            // -
  Star,             // *
  Slash,            // /
  Percent,          // %
  PlusPlus,         // ++
  MinusMinus,       // --

  // ── 其他运算符 ──
  Question,         // ?
  Colon,            // :

  // ── 标点 ──
  Semicolon,        // ;
  Comma,            // ,
  Dot,              // .
  LParen,           // (
  RParen,           // )
  LBrace,           // {
  RBrace,           // }
  LBracket,         // [
  RBracket,         // ]

  // ── 注释 ──
  LineComment,
  BlockComment,
  DocComment,

  // ── 预处理器 ──
  Preprocessor,

  // ── 特殊 ──
  EOF,
  Error,
}

// ─── 关键字映射表 (从 src/data 自动生成) ───

import { KEYWORD_TOKEN_ENTRIES } from '../data';

/**
 * 关键字字符串 -> TokenType 的映射表.
 * 由 src/data/keywords.ts 中的 KEYWORD_TOKEN_ENTRIES 自动构建.
 * 增补关键字/类型时只需修改 KEYWORD_TOKEN_ENTRIES 和 TokenType 枚举.
 */
export const KEYWORD_MAP: Record<string, TokenType> = buildKeywordMap();

function buildKeywordMap(): Record<string, TokenType> {
  const map: Record<string, TokenType> = {};
  for (const [keyword, enumName] of KEYWORD_TOKEN_ENTRIES) {
    const tokenType = (TokenType as any)[enumName];
    if (tokenType !== undefined) {
      map[keyword] = tokenType;
    }
  }
  return map;
}

// ─── 辅助函数 ───

/** 是否为类型关键字 */
export function isTypeKeyword(type: TokenType): boolean {
  return type >= TokenType.KwVoid && type <= TokenType.KwSamplerExternalOES;
}

/** 是否为精度限定符 */
export function isPrecisionQualifier(type: TokenType): boolean {
  return type === TokenType.KwLowp || type === TokenType.KwMediump || type === TokenType.KwHighp;
}

/** 是否为赋值运算符 */
export function isAssignOp(type: TokenType): boolean {
  return type >= TokenType.Assign && type <= TokenType.CaretAssign;
}

/** 是否为关键字 (包括类型关键字) */
export function isKeyword(type: TokenType): boolean {
  return type >= TokenType.KwShaderType && type <= TokenType.KwSamplerExternalOES;
}
