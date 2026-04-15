/**
 * GDShader Uniform 提示数据表
 * Uniform hint 列表及其适用类型.
 */
import { UniformHintInfo } from './types';

// ─── Uniform 提示 (简单列表, 向后兼容) ───
export const UNIFORM_HINTS = [
  'source_color',
  'hint_range',
  'hint_normal',
  'hint_default_white',
  'hint_default_black',
  'hint_default_transparent',
  'hint_anisotropy',
  'hint_roughness',
  'hint_roughness_r',
  'hint_roughness_g',
  'hint_roughness_b',
  'hint_roughness_a',
  'hint_roughness_normal',
  'hint_roughness_gray',
  'hint_screen_texture',
  'hint_depth_texture',
  'hint_normal_roughness_texture',
  'hint_enum',
  'filter_nearest',
  'filter_nearest_mipmap',
  'filter_nearest_mipmap_anisotropic',
  'filter_linear',
  'filter_linear_mipmap',
  'filter_linear_mipmap_anisotropic',
  'repeat_enable',
  'repeat_disable',
  'instance_index',
] as const;

// ─── Uniform 提示详细信息 ───
export const UNIFORM_HINT_DETAILS: UniformHintInfo[] = [
  { name: 'source_color', applicableTypes: ['vec3', 'vec4', 'sampler2D'], description: '标记为 sRGB 颜色.' },
  { name: 'hint_range', applicableTypes: ['int', 'float'], description: '限制值范围: hint_range(min, max[, step]).' },
  { name: 'hint_enum', applicableTypes: ['int'], description: '显示为下拉枚举: hint_enum("A", "B").' },
  { name: 'hint_normal', applicableTypes: ['sampler2D'], description: '用作法线贴图.' },
  { name: 'hint_default_white', applicableTypes: ['sampler2D'], description: '默认不透明白色纹理.' },
  { name: 'hint_default_black', applicableTypes: ['sampler2D'], description: '默认不透明黑色纹理.' },
  { name: 'hint_default_transparent', applicableTypes: ['sampler2D'], description: '默认透明黑色纹理.' },
  { name: 'hint_anisotropy', applicableTypes: ['sampler2D'], description: '用作各向异性流图.' },
  { name: 'hint_roughness', applicableTypes: ['sampler2D'], description: '用于粗糙度限制.' },
  { name: 'hint_roughness_r', applicableTypes: ['sampler2D'], description: '从 R 通道采样粗糙度.' },
  { name: 'hint_roughness_g', applicableTypes: ['sampler2D'], description: '从 G 通道采样粗糙度.' },
  { name: 'hint_roughness_b', applicableTypes: ['sampler2D'], description: '从 B 通道采样粗糙度.' },
  { name: 'hint_roughness_a', applicableTypes: ['sampler2D'], description: '从 A 通道采样粗糙度.' },
  { name: 'hint_roughness_normal', applicableTypes: ['sampler2D'], description: '法线贴图引导的粗糙度限制.' },
  { name: 'hint_roughness_gray', applicableTypes: ['sampler2D'], description: '从灰度采样粗糙度.' },
  { name: 'hint_screen_texture', applicableTypes: ['sampler2D'], description: '屏幕纹理.' },
  { name: 'hint_depth_texture', applicableTypes: ['sampler2D'], description: '深度纹理.' },
  { name: 'hint_normal_roughness_texture', applicableTypes: ['sampler2D'], description: '法线粗糙度纹理 (仅 Forward+).' },
  { name: 'filter_nearest', applicableTypes: ['sampler2D'], description: '最近邻过滤.' },
  { name: 'filter_nearest_mipmap', applicableTypes: ['sampler2D'], description: '最近邻 + mipmap 过滤.' },
  { name: 'filter_nearest_mipmap_anisotropic', applicableTypes: ['sampler2D'], description: '最近邻 + 各向异性 mipmap.' },
  { name: 'filter_linear', applicableTypes: ['sampler2D'], description: '线性过滤.' },
  { name: 'filter_linear_mipmap', applicableTypes: ['sampler2D'], description: '线性 + mipmap 过滤.' },
  { name: 'filter_linear_mipmap_anisotropic', applicableTypes: ['sampler2D'], description: '线性 + 各向异性 mipmap.' },
  { name: 'repeat_enable', applicableTypes: ['sampler2D'], description: '启用纹理重复.' },
  { name: 'repeat_disable', applicableTypes: ['sampler2D'], description: '禁用纹理重复.' },
  { name: 'instance_index', applicableTypes: ['*'], description: '指定实例 uniform 的索引 (0-15).' },
];
