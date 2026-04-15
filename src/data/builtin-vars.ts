/**
 * GDShader 内置变量数据表
 * 所有着色器类型、所有处理器函数的完整内置变量定义.
 * 数据来源: Godot 4.x 官方文档.
 */
import { BuiltinVariable } from './types';

// ═══════════════════════════════════════════════════
// SPATIAL SHADER
// ═══════════════════════════════════════════════════

export const SPATIAL_VERTEX_VARS: BuiltinVariable[] = [
  { name: 'VIEWPORT_SIZE', type: 'vec2', access: 'in', description: '视口大小 (像素).' },
  { name: 'VIEW_MATRIX', type: 'mat4', access: 'in', description: '世界 -> 视图变换矩阵.' },
  { name: 'INV_VIEW_MATRIX', type: 'mat4', access: 'in', description: '视图 -> 世界变换矩阵.' },
  { name: 'MAIN_CAM_INV_VIEW_MATRIX', type: 'mat4', access: 'in', description: '当前视口相机的视图 -> 世界变换.' },
  { name: 'INV_PROJECTION_MATRIX', type: 'mat4', access: 'in', description: '裁剪 -> 视图变换矩阵.' },
  { name: 'NODE_POSITION_WORLD', type: 'vec3', access: 'in', description: '节点世界位置.' },
  { name: 'NODE_POSITION_VIEW', type: 'vec3', access: 'in', description: '节点视图空间位置.' },
  { name: 'CAMERA_POSITION_WORLD', type: 'vec3', access: 'in', description: '相机世界位置.' },
  { name: 'CAMERA_DIRECTION_WORLD', type: 'vec3', access: 'in', description: '相机前方方向.' },
  { name: 'CAMERA_VISIBLE_LAYERS', type: 'uint', access: 'in', description: '相机可见层.' },
  { name: 'INSTANCE_ID', type: 'int', access: 'in', description: '实例 ID.' },
  { name: 'INSTANCE_CUSTOM', type: 'vec4', access: 'in', description: '实例自定义数据.' },
  { name: 'VIEW_INDEX', type: 'int', access: 'in', description: '当前渲染视图索引.' },
  { name: 'VIEW_MONO_LEFT', type: 'int', access: 'in', description: '单眼/左眼常量, 始终为 0.' },
  { name: 'VIEW_RIGHT', type: 'int', access: 'in', description: '右眼常量, 始终为 1.' },
  { name: 'EYE_OFFSET', type: 'vec3', access: 'in', description: '眼部偏移 (多视图渲染).' },
  { name: 'VERTEX', type: 'vec3', access: 'inout', description: '顶点位置 (模型空间).' },
  { name: 'VERTEX_ID', type: 'int', access: 'in', description: '顶点缓冲中的索引.' },
  { name: 'NORMAL', type: 'vec3', access: 'inout', description: '顶点法线 (模型空间).' },
  { name: 'TANGENT', type: 'vec3', access: 'inout', description: '顶点切线 (模型空间).' },
  { name: 'BINORMAL', type: 'vec3', access: 'inout', description: '顶点副法线 (模型空间).' },
  { name: 'POSITION', type: 'vec4', access: 'out', description: '裁剪空间位置 (覆盖). 写入后忽略 VERTEX.' },
  { name: 'UV', type: 'vec2', access: 'inout', description: 'UV 坐标集 1.' },
  { name: 'UV2', type: 'vec2', access: 'inout', description: 'UV 坐标集 2.' },
  { name: 'COLOR', type: 'vec4', access: 'inout', description: '顶点颜色.' },
  { name: 'ROUGHNESS', type: 'float', access: 'out', description: '顶点光照粗糙度.' },
  { name: 'POINT_SIZE', type: 'float', access: 'inout', description: '点渲染时的点大小.' },
  { name: 'MODELVIEW_MATRIX', type: 'mat4', access: 'inout', description: '模型 -> 视图变换矩阵.' },
  { name: 'MODELVIEW_NORMAL_MATRIX', type: 'mat3', access: 'inout', description: '模型法线 -> 视图变换矩阵.' },
  { name: 'MODEL_MATRIX', type: 'mat4', access: 'in', description: '模型 -> 世界变换矩阵.' },
  { name: 'MODEL_NORMAL_MATRIX', type: 'mat3', access: 'in', description: '模型法线 -> 世界变换矩阵.' },
  { name: 'PROJECTION_MATRIX', type: 'mat4', access: 'inout', description: '视图 -> 裁剪变换矩阵.' },
  { name: 'BONE_INDICES', type: 'uvec4', access: 'in', description: '骨骼索引.' },
  { name: 'BONE_WEIGHTS', type: 'vec4', access: 'in', description: '骨骼权重.' },
  { name: 'CUSTOM0', type: 'vec4', access: 'in', description: '自定义顶点数据 0.' },
  { name: 'CUSTOM1', type: 'vec4', access: 'in', description: '自定义顶点数据 1.' },
  { name: 'CUSTOM2', type: 'vec4', access: 'in', description: '自定义顶点数据 2.' },
  { name: 'CUSTOM3', type: 'vec4', access: 'in', description: '自定义顶点数据 3.' },
  { name: 'OUTPUT_IS_SRGB', type: 'bool', access: 'in', description: '输出是否为 sRGB.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

export const SPATIAL_FRAGMENT_VARS: BuiltinVariable[] = [
  { name: 'VIEWPORT_SIZE', type: 'vec2', access: 'in', description: '视口大小 (像素).' },
  { name: 'FRAGCOORD', type: 'vec4', access: 'in', description: '片段坐标 (屏幕空间).' },
  { name: 'FRONT_FACING', type: 'bool', access: 'in', description: '是否为正面.' },
  { name: 'VIEW', type: 'vec3', access: 'in', description: '视线方向 (视图空间).' },
  { name: 'UV', type: 'vec2', access: 'in', description: 'UV 坐标集 1.' },
  { name: 'UV2', type: 'vec2', access: 'in', description: 'UV 坐标集 2.' },
  { name: 'COLOR', type: 'vec4', access: 'in', description: '插值后的顶点颜色.' },
  { name: 'POINT_COORD', type: 'vec2', access: 'in', description: '点精灵坐标.' },
  { name: 'MODEL_MATRIX', type: 'mat4', access: 'in', description: '模型 -> 世界变换矩阵.' },
  { name: 'MODEL_NORMAL_MATRIX', type: 'mat3', access: 'in', description: '模型法线 -> 世界变换矩阵.' },
  { name: 'VIEW_MATRIX', type: 'mat4', access: 'in', description: '世界 -> 视图变换矩阵.' },
  { name: 'INV_VIEW_MATRIX', type: 'mat4', access: 'in', description: '视图 -> 世界变换矩阵.' },
  { name: 'PROJECTION_MATRIX', type: 'mat4', access: 'in', description: '视图 -> 裁剪变换矩阵.' },
  { name: 'INV_PROJECTION_MATRIX', type: 'mat4', access: 'in', description: '裁剪 -> 视图变换矩阵.' },
  { name: 'NODE_POSITION_WORLD', type: 'vec3', access: 'in', description: '节点世界位置.' },
  { name: 'NODE_POSITION_VIEW', type: 'vec3', access: 'in', description: '节点视图空间位置.' },
  { name: 'CAMERA_POSITION_WORLD', type: 'vec3', access: 'in', description: '相机世界位置.' },
  { name: 'CAMERA_DIRECTION_WORLD', type: 'vec3', access: 'in', description: '相机方向.' },
  { name: 'CAMERA_VISIBLE_LAYERS', type: 'uint', access: 'in', description: '相机可见层.' },
  { name: 'VERTEX', type: 'vec3', access: 'in', description: '顶点位置 (视图空间).' },
  { name: 'LIGHT_VERTEX', type: 'vec3', access: 'inout', description: '可写 VERTEX, 用于改变光照/阴影.' },
  { name: 'VIEW_INDEX', type: 'int', access: 'in', description: '当前渲染视图索引.' },
  { name: 'VIEW_MONO_LEFT', type: 'int', access: 'in', description: '单眼/左眼常量.' },
  { name: 'VIEW_RIGHT', type: 'int', access: 'in', description: '右眼常量.' },
  { name: 'EYE_OFFSET', type: 'vec3', access: 'in', description: '眼部偏移.' },
  { name: 'SCREEN_UV', type: 'vec2', access: 'in', description: '屏幕 UV 坐标.' },
  { name: 'DEPTH', type: 'float', access: 'out', description: '自定义深度 (深度覆盖).' },
  { name: 'NORMAL', type: 'vec3', access: 'inout', description: '片段法线 (视图空间).' },
  { name: 'TANGENT', type: 'vec3', access: 'inout', description: '片段切线 (视图空间).' },
  { name: 'BINORMAL', type: 'vec3', access: 'inout', description: '片段副法线 (视图空间).' },
  { name: 'NORMAL_MAP', type: 'vec3', access: 'out', description: '法线贴图 (切线空间).' },
  { name: 'NORMAL_MAP_DEPTH', type: 'float', access: 'out', description: '法线贴图深度.' },
  { name: 'ALBEDO', type: 'vec3', access: 'out', description: '反照率颜色 (默认白色).' },
  { name: 'ALPHA', type: 'float', access: 'out', description: 'Alpha 值. 写入后进入透明管线.' },
  { name: 'ALPHA_SCISSOR_THRESHOLD', type: 'float', access: 'out', description: 'Alpha 裁剪阈值.' },
  { name: 'ALPHA_HASH_SCALE', type: 'float', access: 'out', description: 'Alpha 哈希缩放.' },
  { name: 'ALPHA_ANTIALIASING_EDGE', type: 'float', access: 'out', description: 'Alpha 抗锯齿边缘.' },
  { name: 'ALPHA_TEXTURE_COORDINATE', type: 'vec2', access: 'out', description: 'Alpha 覆盖纹理坐标.' },
  { name: 'PREMUL_ALPHA_FACTOR', type: 'float', access: 'out', description: '预乘 Alpha 因子.' },
  { name: 'METALLIC', type: 'float', access: 'out', description: '金属度.' },
  { name: 'SPECULAR', type: 'float', access: 'out', description: '高光 (默认 0.5).' },
  { name: 'ROUGHNESS', type: 'float', access: 'out', description: '粗糙度.' },
  { name: 'RIM', type: 'float', access: 'out', description: '边缘光强度.' },
  { name: 'RIM_TINT', type: 'float', access: 'out', description: '边缘光色调.' },
  { name: 'CLEARCOAT', type: 'float', access: 'out', description: '清漆层强度.' },
  { name: 'CLEARCOAT_GLOSS', type: 'float', access: 'out', description: '清漆层光泽度.' },
  { name: 'ANISOTROPY', type: 'float', access: 'out', description: '各向异性.' },
  { name: 'ANISOTROPY_FLOW', type: 'vec2', access: 'out', description: '各向异性流方向.' },
  { name: 'SSS_STRENGTH', type: 'float', access: 'out', description: '次表面散射强度.' },
  { name: 'SSS_TRANSMITTANCE_COLOR', type: 'vec4', access: 'out', description: '次表面散射透射颜色.' },
  { name: 'SSS_TRANSMITTANCE_DEPTH', type: 'float', access: 'out', description: '次表面散射透射深度.' },
  { name: 'SSS_TRANSMITTANCE_BOOST', type: 'float', access: 'out', description: '次表面散射透射增强.' },
  { name: 'BACKLIGHT', type: 'vec3', access: 'inout', description: '背光颜色.' },
  { name: 'AO', type: 'float', access: 'out', description: '环境光遮蔽.' },
  { name: 'AO_LIGHT_AFFECT', type: 'float', access: 'out', description: 'AO 光照影响系数.' },
  { name: 'EMISSION', type: 'vec3', access: 'out', description: '自发光颜色.' },
  { name: 'FOG', type: 'vec4', access: 'out', description: '自定义雾颜色与混合.' },
  { name: 'RADIANCE', type: 'vec4', access: 'out', description: '自定义辐射度.' },
  { name: 'IRRADIANCE', type: 'vec4', access: 'out', description: '自定义辐照度.' },
  { name: 'OUTPUT_IS_SRGB', type: 'bool', access: 'in', description: '输出是否为 sRGB.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

export const SPATIAL_LIGHT_VARS: BuiltinVariable[] = [
  { name: 'VIEWPORT_SIZE', type: 'vec2', access: 'in', description: '视口大小 (像素).' },
  { name: 'FRAGCOORD', type: 'vec4', access: 'in', description: '片段坐标 (屏幕空间).' },
  { name: 'MODEL_MATRIX', type: 'mat4', access: 'in', description: '模型 -> 世界变换矩阵.' },
  { name: 'INV_VIEW_MATRIX', type: 'mat4', access: 'in', description: '视图 -> 世界变换矩阵.' },
  { name: 'VIEW_MATRIX', type: 'mat4', access: 'in', description: '世界 -> 视图变换矩阵.' },
  { name: 'PROJECTION_MATRIX', type: 'mat4', access: 'in', description: '视图 -> 裁剪变换矩阵.' },
  { name: 'INV_PROJECTION_MATRIX', type: 'mat4', access: 'in', description: '裁剪 -> 视图变换矩阵.' },
  { name: 'NORMAL', type: 'vec3', access: 'in', description: '片段法线 (视图空间).' },
  { name: 'SCREEN_UV', type: 'vec2', access: 'in', description: '屏幕 UV.' },
  { name: 'UV', type: 'vec2', access: 'in', description: 'UV 坐标集 1.' },
  { name: 'UV2', type: 'vec2', access: 'in', description: 'UV 坐标集 2.' },
  { name: 'VIEW', type: 'vec3', access: 'in', description: '视线方向.' },
  { name: 'LIGHT', type: 'vec3', access: 'in', description: '光照方向 (视图空间).' },
  { name: 'LIGHT_COLOR', type: 'vec3', access: 'in', description: '光照颜色 * 能量 * PI.' },
  { name: 'SPECULAR_AMOUNT', type: 'float', access: 'in', description: '高光量.' },
  { name: 'LIGHT_IS_DIRECTIONAL', type: 'bool', access: 'in', description: '是否为方向光.' },
  { name: 'ATTENUATION', type: 'float', access: 'in', description: '光照衰减.' },
  { name: 'ALBEDO', type: 'vec3', access: 'in', description: '来自片段的反照率.' },
  { name: 'BACKLIGHT', type: 'vec3', access: 'in', description: '背光.' },
  { name: 'METALLIC', type: 'float', access: 'in', description: '来自片段的金属度.' },
  { name: 'ROUGHNESS', type: 'float', access: 'in', description: '来自片段的粗糙度.' },
  { name: 'DIFFUSE_LIGHT', type: 'vec3', access: 'out', description: '漫反射光照输出.' },
  { name: 'SPECULAR_LIGHT', type: 'vec3', access: 'out', description: '高光输出.' },
  { name: 'ALPHA', type: 'float', access: 'out', description: 'Alpha 值.' },
  { name: 'OUTPUT_IS_SRGB', type: 'bool', access: 'in', description: '输出是否为 sRGB.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

// ═══════════════════════════════════════════════════
// CANVAS_ITEM SHADER
// ═══════════════════════════════════════════════════

export const CANVAS_ITEM_VERTEX_VARS: BuiltinVariable[] = [
  { name: 'MODEL_MATRIX', type: 'mat4', access: 'in', description: '局部 -> 世界变换矩阵.' },
  { name: 'CANVAS_MATRIX', type: 'mat4', access: 'in', description: '世界 -> 画布变换矩阵.' },
  { name: 'SCREEN_MATRIX', type: 'mat4', access: 'in', description: '画布 -> 裁剪变换矩阵.' },
  { name: 'INSTANCE_ID', type: 'int', access: 'in', description: '实例 ID.' },
  { name: 'INSTANCE_CUSTOM', type: 'vec4', access: 'in', description: '实例自定义数据.' },
  { name: 'AT_LIGHT_PASS', type: 'bool', access: 'in', description: '始终为 false.' },
  { name: 'TEXTURE_PIXEL_SIZE', type: 'vec2', access: 'in', description: '默认 2D 纹理归一化像素大小.' },
  { name: 'VERTEX', type: 'vec2', access: 'inout', description: '顶点位置 (局部空间, 像素坐标).' },
  { name: 'VERTEX_ID', type: 'int', access: 'in', description: '顶点缓冲中的索引.' },
  { name: 'UV', type: 'vec2', access: 'inout', description: '归一化纹理坐标.' },
  { name: 'COLOR', type: 'vec4', access: 'inout', description: '顶点颜色 * modulate * self_modulate.' },
  { name: 'POINT_SIZE', type: 'float', access: 'inout', description: '点绘制的点大小.' },
  { name: 'CUSTOM0', type: 'vec4', access: 'in', description: '自定义顶点数据 0.' },
  { name: 'CUSTOM1', type: 'vec4', access: 'in', description: '自定义顶点数据 1.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

export const CANVAS_ITEM_FRAGMENT_VARS: BuiltinVariable[] = [
  { name: 'FRAGCOORD', type: 'vec4', access: 'in', description: '片段坐标 (屏幕空间).' },
  { name: 'SCREEN_PIXEL_SIZE', type: 'vec2', access: 'in', description: '单像素大小 (分辨率倒数).' },
  { name: 'REGION_RECT', type: 'vec4', access: 'in', description: 'Sprite 区域 (x, y, w, h).' },
  { name: 'POINT_COORD', type: 'vec2', access: 'in', description: '绘制点时的坐标.' },
  { name: 'TEXTURE', type: 'sampler2D', access: 'in', description: '默认 2D 纹理.' },
  { name: 'TEXTURE_PIXEL_SIZE', type: 'vec2', access: 'in', description: '默认 2D 纹理归一化像素大小.' },
  { name: 'AT_LIGHT_PASS', type: 'bool', access: 'in', description: '始终为 false.' },
  { name: 'SPECULAR_SHININESS_TEXTURE', type: 'sampler2D', access: 'in', description: '高光光泽纹理.' },
  { name: 'SPECULAR_SHININESS', type: 'vec4', access: 'in', description: '高光光泽颜色.' },
  { name: 'UV', type: 'vec2', access: 'in', description: 'UV 坐标.' },
  { name: 'SCREEN_UV', type: 'vec2', access: 'in', description: '屏幕 UV 坐标.' },
  { name: 'NORMAL', type: 'vec3', access: 'inout', description: '从 NORMAL_TEXTURE 读取的法线.' },
  { name: 'NORMAL_TEXTURE', type: 'sampler2D', access: 'in', description: '默认 2D 法线纹理.' },
  { name: 'NORMAL_MAP', type: 'vec3', access: 'out', description: '法线贴图 (覆盖 NORMAL).' },
  { name: 'NORMAL_MAP_DEPTH', type: 'float', access: 'out', description: '法线贴图深度缩放.' },
  { name: 'VERTEX', type: 'vec2', access: 'inout', description: '像素屏幕空间位置.' },
  { name: 'SHADOW_VERTEX', type: 'vec2', access: 'inout', description: '可写, 改变阴影.' },
  { name: 'LIGHT_VERTEX', type: 'vec3', access: 'inout', description: '可写, 改变光照. Z 分量代表高度.' },
  { name: 'COLOR', type: 'vec4', access: 'inout', description: 'vertex() 的 COLOR * TEXTURE 颜色. 也是输出.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

export const CANVAS_ITEM_LIGHT_VARS: BuiltinVariable[] = [
  { name: 'FRAGCOORD', type: 'vec4', access: 'in', description: '片段坐标 (屏幕空间).' },
  { name: 'NORMAL', type: 'vec3', access: 'in', description: '输入法线.' },
  { name: 'COLOR', type: 'vec4', access: 'in', description: 'fragment() 输出的颜色.' },
  { name: 'UV', type: 'vec2', access: 'in', description: 'UV 坐标.' },
  { name: 'TEXTURE', type: 'sampler2D', access: 'in', description: '当前 CanvasItem 使用的纹理.' },
  { name: 'TEXTURE_PIXEL_SIZE', type: 'vec2', access: 'in', description: 'TEXTURE 归一化像素大小.' },
  { name: 'SCREEN_UV', type: 'vec2', access: 'in', description: '屏幕 UV 坐标.' },
  { name: 'POINT_COORD', type: 'vec2', access: 'in', description: '点精灵的 UV.' },
  { name: 'LIGHT_COLOR', type: 'vec4', access: 'in', description: 'Light2D 颜色.' },
  { name: 'LIGHT_ENERGY', type: 'float', access: 'in', description: 'Light2D 能量.' },
  { name: 'LIGHT_POSITION', type: 'vec3', access: 'in', description: 'Light2D 屏幕空间位置.' },
  { name: 'LIGHT_DIRECTION', type: 'vec3', access: 'in', description: 'Light2D 屏幕空间方向.' },
  { name: 'LIGHT_IS_DIRECTIONAL', type: 'bool', access: 'in', description: '是否为 DirectionalLight2D.' },
  { name: 'LIGHT_VERTEX', type: 'vec3', access: 'in', description: '像素位置 (经 fragment 修改后).' },
  { name: 'LIGHT', type: 'vec4', access: 'inout', description: 'Light2D 输出颜色.' },
  { name: 'SPECULAR_SHININESS', type: 'vec4', access: 'in', description: '高光光泽设置.' },
  { name: 'SHADOW_MODULATE', type: 'vec4', access: 'out', description: '阴影调制颜色.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

// ═══════════════════════════════════════════════════
// PARTICLES SHADER
// ═══════════════════════════════════════════════════

/** start() 和 process() 共享的内置变量 */
const PARTICLES_SHARED_VARS: BuiltinVariable[] = [
  { name: 'LIFETIME', type: 'float', access: 'in', description: '粒子生命周期.' },
  { name: 'DELTA', type: 'float', access: 'in', description: '帧间隔时间.' },
  { name: 'NUMBER', type: 'uint', access: 'in', description: '自发射开始的唯一编号.' },
  { name: 'INDEX', type: 'uint', access: 'in', description: '粒子索引 (从总数中).' },
  { name: 'EMISSION_TRANSFORM', type: 'mat4', access: 'in', description: '发射器变换.' },
  { name: 'RANDOM_SEED', type: 'uint', access: 'in', description: '随机种子.' },
  { name: 'ACTIVE', type: 'bool', access: 'inout', description: '粒子是否激活.' },
  { name: 'COLOR', type: 'vec4', access: 'inout', description: '粒子颜色.' },
  { name: 'VELOCITY', type: 'vec3', access: 'inout', description: '粒子速度.' },
  { name: 'TRANSFORM', type: 'mat4', access: 'inout', description: '粒子变换.' },
  { name: 'CUSTOM', type: 'vec4', access: 'inout', description: '自定义粒子数据.' },
  { name: 'MASS', type: 'float', access: 'inout', description: '粒子质量 (默认 1.0).' },
  { name: 'USERDATA1', type: 'vec4', access: 'in', description: '用户自定义数据 1.' },
  { name: 'USERDATA2', type: 'vec4', access: 'in', description: '用户自定义数据 2.' },
  { name: 'USERDATA3', type: 'vec4', access: 'in', description: '用户自定义数据 3.' },
  { name: 'USERDATA4', type: 'vec4', access: 'in', description: '用户自定义数据 4.' },
  { name: 'USERDATA5', type: 'vec4', access: 'in', description: '用户自定义数据 5.' },
  { name: 'USERDATA6', type: 'vec4', access: 'in', description: '用户自定义数据 6.' },
  { name: 'FLAG_EMIT_POSITION', type: 'uint', access: 'in', description: 'emit_subparticle 标志: 位置.' },
  { name: 'FLAG_EMIT_ROT_SCALE', type: 'uint', access: 'in', description: 'emit_subparticle 标志: 旋转/缩放.' },
  { name: 'FLAG_EMIT_VELOCITY', type: 'uint', access: 'in', description: 'emit_subparticle 标志: 速度.' },
  { name: 'FLAG_EMIT_COLOR', type: 'uint', access: 'in', description: 'emit_subparticle 标志: 颜色.' },
  { name: 'FLAG_EMIT_CUSTOM', type: 'uint', access: 'in', description: 'emit_subparticle 标志: 自定义.' },
  { name: 'EMITTER_VELOCITY', type: 'vec3', access: 'in', description: '发射器节点速度.' },
  { name: 'INTERPOLATE_TO_END', type: 'float', access: 'in', description: 'interp_to_end 属性值.' },
  { name: 'AMOUNT_RATIO', type: 'uint', access: 'in', description: 'amount_ratio 属性值.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

export const PARTICLES_START_VARS: BuiltinVariable[] = [
  ...PARTICLES_SHARED_VARS,
  { name: 'RESTART_POSITION', type: 'bool', access: 'in', description: '是否重置位置.' },
  { name: 'RESTART_ROT_SCALE', type: 'bool', access: 'in', description: '是否重置旋转/缩放.' },
  { name: 'RESTART_VELOCITY', type: 'bool', access: 'in', description: '是否重置速度.' },
  { name: 'RESTART_COLOR', type: 'bool', access: 'in', description: '是否重置颜色.' },
  { name: 'RESTART_CUSTOM', type: 'bool', access: 'in', description: '是否重置自定义属性.' },
];

export const PARTICLES_PROCESS_VARS: BuiltinVariable[] = [
  ...PARTICLES_SHARED_VARS,
  { name: 'RESTART', type: 'bool', access: 'in', description: '当前帧是否为粒子的第一帧.' },
  { name: 'COLLIDED', type: 'bool', access: 'in', description: '是否发生碰撞.' },
  { name: 'COLLISION_NORMAL', type: 'vec3', access: 'in', description: '碰撞法线.' },
  { name: 'COLLISION_DEPTH', type: 'float', access: 'in', description: '碰撞深度.' },
  { name: 'ATTRACTOR_FORCE', type: 'vec3', access: 'in', description: '吸引力.' },
];

// ═══════════════════════════════════════════════════
// SKY SHADER
// ═══════════════════════════════════════════════════

export const SKY_VARS: BuiltinVariable[] = [
  { name: 'EYEDIR', type: 'vec3', access: 'in', description: '当前像素的归一化方向.' },
  { name: 'SCREEN_UV', type: 'vec2', access: 'in', description: '屏幕 UV 坐标.' },
  { name: 'SKY_COORDS', type: 'vec2', access: 'in', description: '球形 UV, 用于全景纹理映射.' },
  { name: 'HALF_RES_COLOR', type: 'vec4', access: 'in', description: '半分辨率通道颜色.' },
  { name: 'QUARTER_RES_COLOR', type: 'vec4', access: 'in', description: '四分之一分辨率通道颜色.' },
  { name: 'COLOR', type: 'vec3', access: 'out', description: '输出颜色.' },
  { name: 'ALPHA', type: 'float', access: 'out', description: '输出 Alpha (仅子通道).' },
  { name: 'FOG', type: 'vec4', access: 'out', description: '雾颜色输出.' },
  { name: 'POSITION', type: 'vec3', access: 'in', description: '相机位置 (世界空间).' },
  { name: 'RADIANCE', type: 'samplerCube', access: 'in', description: '辐射度立方体贴图 (仅背景通道).' },
  { name: 'AT_HALF_RES_PASS', type: 'bool', access: 'in', description: '是否在半分辨率通道.' },
  { name: 'AT_QUARTER_RES_PASS', type: 'bool', access: 'in', description: '是否在四分之一分辨率通道.' },
  { name: 'AT_CUBEMAP_PASS', type: 'bool', access: 'in', description: '是否在辐射度立方体贴图通道.' },
  { name: 'LIGHT0_ENABLED', type: 'bool', access: 'in', description: '光源 0 是否启用.' },
  { name: 'LIGHT0_DIRECTION', type: 'vec3', access: 'in', description: '光源 0 方向.' },
  { name: 'LIGHT0_ENERGY', type: 'float', access: 'in', description: '光源 0 能量.' },
  { name: 'LIGHT0_COLOR', type: 'vec3', access: 'in', description: '光源 0 颜色.' },
  { name: 'LIGHT0_SIZE', type: 'float', access: 'in', description: '光源 0 角直径 (弧度).' },
  { name: 'LIGHT1_ENABLED', type: 'bool', access: 'in', description: '光源 1 是否启用.' },
  { name: 'LIGHT1_DIRECTION', type: 'vec3', access: 'in', description: '光源 1 方向.' },
  { name: 'LIGHT1_ENERGY', type: 'float', access: 'in', description: '光源 1 能量.' },
  { name: 'LIGHT1_COLOR', type: 'vec3', access: 'in', description: '光源 1 颜色.' },
  { name: 'LIGHT1_SIZE', type: 'float', access: 'in', description: '光源 1 角直径.' },
  { name: 'LIGHT2_ENABLED', type: 'bool', access: 'in', description: '光源 2 是否启用.' },
  { name: 'LIGHT2_DIRECTION', type: 'vec3', access: 'in', description: '光源 2 方向.' },
  { name: 'LIGHT2_ENERGY', type: 'float', access: 'in', description: '光源 2 能量.' },
  { name: 'LIGHT2_COLOR', type: 'vec3', access: 'in', description: '光源 2 颜色.' },
  { name: 'LIGHT2_SIZE', type: 'float', access: 'in', description: '光源 2 角直径.' },
  { name: 'LIGHT3_ENABLED', type: 'bool', access: 'in', description: '光源 3 是否启用.' },
  { name: 'LIGHT3_DIRECTION', type: 'vec3', access: 'in', description: '光源 3 方向.' },
  { name: 'LIGHT3_ENERGY', type: 'float', access: 'in', description: '光源 3 能量.' },
  { name: 'LIGHT3_COLOR', type: 'vec3', access: 'in', description: '光源 3 颜色.' },
  { name: 'LIGHT3_SIZE', type: 'float', access: 'in', description: '光源 3 角直径.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

// ═══════════════════════════════════════════════════
// FOG SHADER
// ═══════════════════════════════════════════════════

export const FOG_VARS: BuiltinVariable[] = [
  { name: 'WORLD_POSITION', type: 'vec3', access: 'in', description: '当前体素在世界空间的位置.' },
  { name: 'OBJECT_POSITION', type: 'vec3', access: 'in', description: 'FogVolume 中心的世界空间位置.' },
  { name: 'UVW', type: 'vec3', access: 'in', description: '3D UV, 用于映射 3D 纹理.' },
  { name: 'SIZE', type: 'vec3', access: 'in', description: 'FogVolume 大小.' },
  { name: 'SDF', type: 'vec3', access: 'in', description: '到 FogVolume 表面的有符号距离场.' },
  { name: 'ALBEDO', type: 'vec3', access: 'out', description: '输出基色, 与光照交互.' },
  { name: 'DENSITY', type: 'float', access: 'out', description: '输出密度 (可为负, 减去体积).' },
  { name: 'EMISSION', type: 'vec3', access: 'out', description: '输出自发光颜色.' },
  { name: 'TIME', type: 'float', access: 'in', description: '全局时间 (秒).' },
];

// ═══════════════════════════════════════════════════
// 完整映射表: shader_type -> processor_function -> BuiltinVariable[]
// ═══════════════════════════════════════════════════

export const BUILTIN_VARS: Record<string, Record<string, BuiltinVariable[]>> = {
  spatial: {
    vertex: SPATIAL_VERTEX_VARS,
    fragment: SPATIAL_FRAGMENT_VARS,
    light: SPATIAL_LIGHT_VARS,
  },
  canvas_item: {
    vertex: CANVAS_ITEM_VERTEX_VARS,
    fragment: CANVAS_ITEM_FRAGMENT_VARS,
    light: CANVAS_ITEM_LIGHT_VARS,
  },
  particles: {
    start: PARTICLES_START_VARS,
    process: PARTICLES_PROCESS_VARS,
  },
  sky: {
    sky: SKY_VARS,
  },
  fog: {
    fog: FOG_VARS,
  },
};
