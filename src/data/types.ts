/**
 * GDShader 数据类型定义
 * 所有数据表共用的接口和类型定义.
 */

/** 着色器类型 */
export type ShaderType = 'spatial' | 'canvas_item' | 'particles' | 'sky' | 'fog';

/** 处理器函数名 */
export type ProcessorFunction = 'vertex' | 'fragment' | 'light' | 'start' | 'process' | 'sky' | 'fog';

/** 内置函数定义 */
export interface BuiltinFunction {
  name: string;
  signature: string;
  description: string;
  /** 仅在某些上下文可用 (如 'fragment' 表示仅 fragment 着色器) */
  context?: ProcessorFunction[];
}

/** 内置变量定义 */
export interface BuiltinVariable {
  name: string;
  type: string;
  access: 'in' | 'out' | 'inout';
  description: string;
}

/** 渲染模式定义 */
export interface RenderModeInfo {
  name: string;
  description: string;
}

/** Uniform hint 定义 */
export interface UniformHintInfo {
  name: string;
  /** 适用的类型 */
  applicableTypes: string[];
  description: string;
}

/** 语法约束规则 */
export interface SyntaxRule {
  id: string;
  description: string;
  /** 适用的着色器类型, 为空表示所有类型 */
  shaderTypes?: ShaderType[];
  /** 适用的处理器函数, 为空表示所有函数 */
  processorFunctions?: ProcessorFunction[];
}

/** 处理器函数特化信息 */
export interface ProcessorFunctionInfo {
  name: ProcessorFunction;
  /** 该处理器函数属于哪些着色器类型 */
  shaderTypes: ShaderType[];
  /** 是否允许 return 语句 (处理器函数不允许有返回值, 但允许空 return) */
  allowReturn: boolean;
  /** 是否支持 discard */
  allowDiscard: boolean;
  description: string;
}

/** 后续语法要素: 某个语法要素后面通常会跟随什么 */
export interface SyntaxFollowRule {
  /** 前置语法要素 (如 'shader_type', 'render_mode', 'uniform', ':' 等) */
  trigger: string;
  /** 触发条件的正则 */
  triggerPattern: RegExp;
  /** 后续应该出现的候选项类别 */
  followKind: 'shader_type' | 'render_mode' | 'uniform_hint' | 'type' | 'processor_function' | 'builtin_var';
  /** 是否需要按 shader 类型过滤 */
  filterByShaderType: boolean;
  /** 是否需要按处理器函数过滤 */
  filterByProcessorFn: boolean;
  description: string;
}
