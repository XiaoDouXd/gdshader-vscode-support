/**
 * GDShader 语法规则与处理器函数特化数据表
 * 定义语法约束, 后续语法要素匹配, 处理器函数特性等.
 */
import { ProcessorFunctionInfo, SyntaxFollowRule, SyntaxRule } from './types';

// ─── 处理器函数特化信息 ───
export const PROCESSOR_FUNCTION_INFO: ProcessorFunctionInfo[] = [
  {
    name: 'vertex',
    shaderTypes: ['spatial', 'canvas_item'],
    allowReturn: false,
    allowDiscard: false,
    description: '顶点处理器函数, 处理顶点变换.',
  },
  {
    name: 'fragment',
    shaderTypes: ['spatial', 'canvas_item'],
    allowReturn: false,
    allowDiscard: true,
    description: '片段处理器函数, 设置材质属性.',
  },
  {
    name: 'light',
    shaderTypes: ['spatial', 'canvas_item'],
    allowReturn: false,
    allowDiscard: true,
    description: '光照处理器函数, 自定义光照计算.',
  },
  {
    name: 'start',
    shaderTypes: ['particles'],
    allowReturn: false,
    allowDiscard: false,
    description: '粒子初始化处理器函数.',
  },
  {
    name: 'process',
    shaderTypes: ['particles'],
    allowReturn: false,
    allowDiscard: false,
    description: '粒子更新处理器函数.',
  },
  {
    name: 'sky',
    shaderTypes: ['sky'],
    allowReturn: false,
    allowDiscard: false,
    description: '天空处理器函数.',
  },
  {
    name: 'fog',
    shaderTypes: ['fog'],
    allowReturn: false,
    allowDiscard: false,
    description: '雾效处理器函数.',
  },
];

// ─── 语法约束规则 ───
export const SYNTAX_RULES: SyntaxRule[] = [
  {
    id: 'no-return-value-in-processor',
    description: '处理器函数 (void) 不能 return 带值的表达式, 只允许空 return.',
  },
  {
    id: 'discard-only-in-fragment-light',
    description: 'discard 仅可在 fragment(), light() 及其调用的自定义函数中使用.',
    processorFunctions: ['fragment', 'light'],
  },
  {
    id: 'varying-assign-vertex-fragment-only',
    description: 'varying 变量只能在 vertex() 或 fragment() 中赋值, 不能在 light() 或自定义函数中赋值.',
    processorFunctions: ['vertex', 'fragment'],
  },
  {
    id: 'shader-type-required',
    description: 'GDShader 文件必须以 shader_type 声明开头.',
  },
  {
    id: 'no-implicit-casting',
    description: '不支持隐式类型转换, 必须使用显式构造函数 (如 float(2)).',
  },
  {
    id: 'function-defined-before-use',
    description: '函数必须在使用前定义 (在文件中位置靠上).',
  },
  {
    id: 'local-vars-uninitialized',
    description: '局部变量不会自动初始化为默认值, 使用前必须赋值.',
  },
  {
    id: 'write-to-out-only',
    description: '标记为 out 的内置变量只能写入, 读取前必须先写入.',
  },
  {
    id: 'read-in-only',
    description: '标记为 in 的内置变量是只读的, 不能写入.',
  },
];

// ─── 后续语法要素匹配规则 ───
// 定义 "X 后面通常跟 Y" 的通用构造, 用于代码补全和诊断
export const SYNTAX_FOLLOW_RULES: SyntaxFollowRule[] = [
  {
    trigger: 'shader_type',
    triggerPattern: /shader_type\s+\w*$/,
    followKind: 'shader_type',
    filterByShaderType: false,
    filterByProcessorFn: false,
    description: 'shader_type 后面跟着色器类型名.',
  },
  {
    trigger: 'render_mode',
    triggerPattern: /render_mode\s+[\w,\s]*$/,
    followKind: 'render_mode',
    filterByShaderType: true,
    filterByProcessorFn: false,
    description: 'render_mode 后面跟渲染模式值 (按 shader 类型过滤).',
  },
  {
    trigger: 'uniform_hint',
    // 位于 uniform 声明的 hint 段: 首次 `:` 之后, 直到 `=` 或 `;` 之前.
    // 既匹配首个 hint `uniform X Y : |`, 也匹配后续 `uniform X Y : ha, |` / `uniform X Y : ha(0), |`.
    triggerPattern: /\buniform\s+\w+\s+\w+\s*(?:\[[^\]]*\])?\s*:\s*[^=;]*$/,
    followKind: 'uniform_hint',
    filterByShaderType: false,
    filterByProcessorFn: false,
    description: 'uniform 声明 hint 段 (冒号之后) 的补全, 支持多 hint.',
  },
  {
    trigger: 'type_declaration',
    triggerPattern: /(?:uniform|varying|const)\s+\w*$/,
    followKind: 'type',
    filterByShaderType: false,
    filterByProcessorFn: false,
    description: '存储限定符后面跟类型名.',
  },
];

// ─── 特殊内置变量分类 ───
// 这些变量在特定上下文中有特殊含义

/** 只在 spatial fragment 中可作为输出的变量 (PBR 属性) */
export const SPATIAL_PBR_OUTPUTS = [
  'ALBEDO', 'ALPHA', 'METALLIC', 'ROUGHNESS', 'SPECULAR',
  'RIM', 'RIM_TINT', 'CLEARCOAT', 'CLEARCOAT_GLOSS',
  'ANISOTROPY', 'ANISOTROPY_FLOW',
  'SSS_STRENGTH', 'SSS_TRANSMITTANCE_COLOR', 'SSS_TRANSMITTANCE_DEPTH', 'SSS_TRANSMITTANCE_BOOST',
  'BACKLIGHT', 'AO', 'AO_LIGHT_AFFECT', 'EMISSION',
  'NORMAL_MAP', 'NORMAL_MAP_DEPTH', 'DEPTH',
  'FOG', 'RADIANCE', 'IRRADIANCE',
] as const;

/** 只在 spatial light 中可作为输出的变量 */
export const SPATIAL_LIGHT_OUTPUTS = [
  'DIFFUSE_LIGHT', 'SPECULAR_LIGHT', 'ALPHA',
] as const;

/** canvas_item fragment 输出变量 */
export const CANVAS_ITEM_FRAGMENT_OUTPUTS = [
  'COLOR', 'NORMAL', 'NORMAL_MAP', 'NORMAL_MAP_DEPTH',
  'SHADOW_VERTEX', 'LIGHT_VERTEX', 'VERTEX',
] as const;

/** 粒子着色器可修改的变量 */
export const PARTICLES_MODIFIABLE = [
  'ACTIVE', 'COLOR', 'VELOCITY', 'TRANSFORM', 'CUSTOM', 'MASS',
] as const;

/** 天空着色器输出变量 */
export const SKY_OUTPUTS = ['COLOR', 'ALPHA', 'FOG'] as const;

/** 雾着色器输出变量 */
export const FOG_OUTPUTS = ['ALBEDO', 'DENSITY', 'EMISSION'] as const;
