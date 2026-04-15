/**
 * GDShader 数据层统一导出
 * 从各独立数据表文件重新导出, 保持向后兼容.
 */

// 类型定义
export type {
  ShaderType, ProcessorFunction,
  BuiltinFunction, BuiltinVariable,
  RenderModeInfo, UniformHintInfo,
  SyntaxRule, ProcessorFunctionInfo, SyntaxFollowRule,
} from './types';

// 基础类型和关键字
export {
  SHADER_TYPES, PROCESSOR_FUNCTIONS,
  SCALAR_TYPES, VECTOR_TYPES, MATRIX_TYPES, SAMPLER_TYPES, ALL_TYPES,
  CONTROL_KEYWORDS, STORAGE_QUALIFIERS, ALL_KEYWORDS,
  KEYWORD_TOKEN_ENTRIES,
  BUILTIN_CONSTANTS, CONSTANT_VALUES,
} from './keywords';

// 渲染模式
export { RENDER_MODES } from './render-modes';

// Uniform 提示
export { UNIFORM_HINTS, UNIFORM_HINT_DETAILS } from './uniform-hints';

// 内置函数
export { BUILTIN_FUNCTIONS } from './builtin-functions';

// 内置变量
export {
  SPATIAL_VERTEX_VARS, SPATIAL_FRAGMENT_VARS, SPATIAL_LIGHT_VARS,
  CANVAS_ITEM_VERTEX_VARS, CANVAS_ITEM_FRAGMENT_VARS, CANVAS_ITEM_LIGHT_VARS,
  PARTICLES_START_VARS, PARTICLES_PROCESS_VARS,
  SKY_VARS, FOG_VARS,
  BUILTIN_VARS,
} from './builtin-vars';

// 语法规则和处理器函数特化
export {
  PROCESSOR_FUNCTION_INFO, SYNTAX_RULES, SYNTAX_FOLLOW_RULES,
  SPATIAL_PBR_OUTPUTS, SPATIAL_LIGHT_OUTPUTS,
  CANVAS_ITEM_FRAGMENT_OUTPUTS, PARTICLES_MODIFIABLE,
  SKY_OUTPUTS, FOG_OUTPUTS,
} from './syntax-rules';
