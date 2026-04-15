/**
 * GDShader 基础类型和关键字数据表
 * 包含数据类型, 关键字, 常量等基础语言元素.
 *
 * 这是所有关键字/类型名的**唯一数据源**.
 * parser/token.ts 中的 KEYWORD_MAP 从此处自动生成, 不要手动维护两份.
 */
import { ShaderType, ProcessorFunction } from './types';

// ─── 着色器类型 ───
export const SHADER_TYPES: readonly ShaderType[] = ['spatial', 'canvas_item', 'particles', 'sky', 'fog'] as const;

// ─── 各着色器类型对应的处理器函数 ───
export const PROCESSOR_FUNCTIONS: Record<ShaderType, ProcessorFunction[]> = {
  spatial: ['vertex', 'fragment', 'light'],
  canvas_item: ['vertex', 'fragment', 'light'],
  particles: ['start', 'process'],
  sky: ['sky'],
  fog: ['fog'],
};

// ─── 数据类型 ───
export const SCALAR_TYPES = ['void', 'bool', 'int', 'uint', 'float'] as const;
export const VECTOR_TYPES = [
  'vec2', 'vec3', 'vec4',
  'bvec2', 'bvec3', 'bvec4',
  'ivec2', 'ivec3', 'ivec4',
  'uvec2', 'uvec3', 'uvec4',
] as const;
export const MATRIX_TYPES = ['mat2', 'mat3', 'mat4'] as const;
export const SAMPLER_TYPES = [
  'sampler2D', 'isampler2D', 'usampler2D',
  'sampler2DArray', 'isampler2DArray', 'usampler2DArray',
  'sampler3D', 'isampler3D', 'usampler3D',
  'samplerCube', 'samplerCubeArray', 'samplerExternalOES',
] as const;
export const ALL_TYPES: string[] = [
  ...SCALAR_TYPES, ...VECTOR_TYPES, ...MATRIX_TYPES, ...SAMPLER_TYPES,
];

// ─── 关键字 ───
export const CONTROL_KEYWORDS = [
  'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'default',
  'break', 'continue', 'return', 'discard',
] as const;
export const STORAGE_QUALIFIERS = [
  'uniform', 'varying', 'const', 'struct',
  'flat', 'smooth',
  'in', 'out', 'inout',
  'lowp', 'mediump', 'highp',
  'global', 'instance',
  'group_uniforms',
] as const;
export const ALL_KEYWORDS: string[] = [
  'shader_type', 'render_mode',
  ...CONTROL_KEYWORDS,
  ...STORAGE_QUALIFIERS,
  'true', 'false',
];

/**
 * 所有语言保留字 (关键字 + 类型名), 按类别分组.
 * parser/token.ts 从这里自动构建 KEYWORD_MAP.
 *
 * 增补新关键字/类型时, 只需修改此处和 TokenType 枚举.
 * KEYWORD_MAP 会自动同步.
 */
export const KEYWORD_TOKEN_ENTRIES: readonly [string, string][] = [
  // 语言关键字 -> 对应的 TokenType 枚举名
  ['shader_type', 'KwShaderType'],
  ['render_mode', 'KwRenderMode'],
  ['uniform', 'KwUniform'],
  ['varying', 'KwVarying'],
  ['const', 'KwConst'],
  ['struct', 'KwStruct'],
  ['group_uniforms', 'KwGroupUniforms'],
  ['global', 'KwGlobal'],
  ['instance', 'KwInstance'],
  ['flat', 'KwFlat'],
  ['smooth', 'KwSmooth'],
  ['in', 'KwIn'],
  ['out', 'KwOut'],
  ['inout', 'KwInout'],
  ['lowp', 'KwLowp'],
  ['mediump', 'KwMediump'],
  ['highp', 'KwHighp'],
  ['if', 'KwIf'],
  ['else', 'KwElse'],
  ['for', 'KwFor'],
  ['while', 'KwWhile'],
  ['do', 'KwDo'],
  ['switch', 'KwSwitch'],
  ['case', 'KwCase'],
  ['default', 'KwDefault'],
  ['break', 'KwBreak'],
  ['continue', 'KwContinue'],
  ['return', 'KwReturn'],
  ['discard', 'KwDiscard'],
  ['true', 'KwTrue'],
  ['false', 'KwFalse'],
  // 内置类型 (自动从 ALL_TYPES 生成, 使用精确映射)
  ...ALL_TYPES.map(t => [t, `Kw${typeToEnumSuffix(t)}`] as [string, string]),
];

/** 类型名 -> TokenType 枚举后缀. 处理 isampler/usampler 等大小写不规则的情况. */
function typeToEnumSuffix(typeName: string): string {
  // 特殊前缀: isampler -> ISampler, usampler -> USampler
  if (typeName.startsWith('isampler')) return 'I' + capitalize(typeName.slice(1));
  if (typeName.startsWith('usampler')) return 'U' + capitalize(typeName.slice(1));
  return capitalize(typeName);
}

/** 首字母大写 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── 内置常量 ───
export const BUILTIN_CONSTANTS = ['PI', 'TAU', 'E', 'INF', 'NAN'] as const;

/** 常量精确值映射 */
export const CONSTANT_VALUES: Record<string, string> = {
  PI: '3.14159265358979323846',
  TAU: '6.28318530717958647692',
  E: '2.71828182845904523536',
  INF: 'Infinity',
  NAN: 'NaN',
};
