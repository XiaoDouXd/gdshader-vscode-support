/**
 * GDShader 内置函数数据表
 * 基于 Godot 4.x 着色语言参考文档, 包含完整的 GLSL ES 3.0 子集函数.
 */
import { BuiltinFunction } from './types';

export const BUILTIN_FUNCTIONS: BuiltinFunction[] = [
  // ─── 角度与三角函数 ───
  { name: 'radians', signature: 'T radians(T degrees)', description: '将角度转换为弧度.' },
  { name: 'degrees', signature: 'T degrees(T radians)', description: '将弧度转换为角度.' },
  { name: 'sin', signature: 'T sin(T angle)', description: '正弦.' },
  { name: 'cos', signature: 'T cos(T angle)', description: '余弦.' },
  { name: 'tan', signature: 'T tan(T angle)', description: '正切.' },
  { name: 'asin', signature: 'T asin(T x)', description: '反正弦.' },
  { name: 'acos', signature: 'T acos(T x)', description: '反余弦.' },
  { name: 'atan', signature: 'T atan(T y, T x)', description: '反正切 (双参数).' },
  { name: 'sinh', signature: 'T sinh(T x)', description: '双曲正弦.' },
  { name: 'cosh', signature: 'T cosh(T x)', description: '双曲余弦.' },
  { name: 'tanh', signature: 'T tanh(T x)', description: '双曲正切.' },
  { name: 'asinh', signature: 'T asinh(T x)', description: '反双曲正弦.' },
  { name: 'acosh', signature: 'T acosh(T x)', description: '反双曲余弦.' },
  { name: 'atanh', signature: 'T atanh(T x)', description: '反双曲正切.' },

  // ─── 指数函数 ───
  { name: 'pow', signature: 'T pow(T base, T exponent)', description: '幂函数.' },
  { name: 'exp', signature: 'T exp(T x)', description: '自然指数 (e^x).' },
  { name: 'exp2', signature: 'T exp2(T x)', description: '以 2 为底的指数 (2^x).' },
  { name: 'log', signature: 'T log(T x)', description: '自然对数.' },
  { name: 'log2', signature: 'T log2(T x)', description: '以 2 为底的对数.' },
  { name: 'sqrt', signature: 'T sqrt(T x)', description: '平方根.' },
  { name: 'inversesqrt', signature: 'T inversesqrt(T x)', description: '平方根的倒数 (1/sqrt(x)).' },

  // ─── 通用函数 ───
  { name: 'abs', signature: 'T abs(T x)', description: '绝对值.' },
  { name: 'sign', signature: 'T sign(T x)', description: '符号函数 (-1, 0 或 1).' },
  { name: 'floor', signature: 'T floor(T x)', description: '向下取整.' },
  { name: 'round', signature: 'T round(T x)', description: '四舍五入.' },
  { name: 'roundEven', signature: 'T roundEven(T x)', description: '四舍五入到最近的偶数.' },
  { name: 'trunc', signature: 'T trunc(T x)', description: '截断小数部分.' },
  { name: 'ceil', signature: 'T ceil(T x)', description: '向上取整.' },
  { name: 'fract', signature: 'T fract(T x)', description: '小数部分 (x - floor(x)).' },
  { name: 'mod', signature: 'T mod(T x, T y)', description: '取模 (x - y * floor(x/y)).' },
  { name: 'min', signature: 'T min(T a, T b)', description: '最小值.' },
  { name: 'max', signature: 'T max(T a, T b)', description: '最大值.' },
  { name: 'clamp', signature: 'T clamp(T x, T min, T max)', description: '限制 x 在 [min, max] 范围内.' },
  { name: 'mix', signature: 'T mix(T a, T b, T t)', description: '线性插值: a*(1-t) + b*t.' },
  { name: 'fma', signature: 'T fma(T a, T b, T c)', description: '融合乘加: a*b + c.' },
  { name: 'step', signature: 'T step(T edge, T x)', description: '阶跃函数: x < edge 时为 0.0, 否则为 1.0.' },
  { name: 'smoothstep', signature: 'T smoothstep(T edge0, T edge1, T x)', description: 'Hermite 平滑插值, 结果在 0 到 1 之间.' },
  { name: 'isnan', signature: 'bool isnan(T x)', description: '判断 x 是否为 NaN.' },
  { name: 'isinf', signature: 'bool isinf(T x)', description: '判断 x 是否为无穷大.' },
  { name: 'floatBitsToInt', signature: 'int floatBitsToInt(float x)', description: '将浮点位模式重新解释为整数.' },
  { name: 'floatBitsToUint', signature: 'uint floatBitsToUint(float x)', description: '将浮点位模式重新解释为无符号整数.' },
  { name: 'intBitsToFloat', signature: 'float intBitsToFloat(int x)', description: '将整数位模式重新解释为浮点数.' },
  { name: 'uintBitsToFloat', signature: 'float uintBitsToFloat(uint x)', description: '将无符号整数位模式重新解释为浮点数.' },

  // ─── 几何函数 ───
  { name: 'length', signature: 'float length(T x)', description: '向量长度.' },
  { name: 'distance', signature: 'float distance(T p0, T p1)', description: '两点之间的距离.' },
  { name: 'dot', signature: 'float dot(T x, T y)', description: '点积.' },
  { name: 'cross', signature: 'vec3 cross(vec3 a, vec3 b)', description: '叉积.' },
  { name: 'normalize', signature: 'T normalize(T x)', description: '归一化向量.' },
  { name: 'reflect', signature: 'T reflect(T I, T N)', description: '以法线 N 反射向量 I.' },
  { name: 'refract', signature: 'T refract(T I, T N, float eta)', description: '折射向量.' },
  { name: 'faceforward', signature: 'T faceforward(T N, T I, T Nref)', description: '翻转 N 使其朝向 I.' },

  // ─── 矩阵函数 ───
  { name: 'matrixCompMult', signature: 'mat matrixCompMult(mat a, mat b)', description: '矩阵逐分量乘法.' },
  { name: 'outerProduct', signature: 'mat outerProduct(vec c, vec r)', description: '两个向量的外积.' },
  { name: 'transpose', signature: 'mat transpose(mat m)', description: '矩阵转置.' },
  { name: 'determinant', signature: 'float determinant(mat m)', description: '矩阵行列式.' },
  { name: 'inverse', signature: 'mat inverse(mat m)', description: '矩阵求逆.' },

  // ─── 纹理函数 ───
  { name: 'texture', signature: 'vec4 texture(sampler2D s, vec2 uv)', description: '纹理采样.' },
  { name: 'textureSize', signature: 'ivec2 textureSize(sampler2D s, int lod)', description: '获取纹理尺寸.' },
  { name: 'textureLod', signature: 'vec4 textureLod(sampler2D s, vec2 uv, float lod)', description: '指定 LOD 级别采样纹理.' },
  { name: 'textureGrad', signature: 'vec4 textureGrad(sampler2D s, vec2 uv, vec2 dPdx, vec2 dPdy)', description: '使用显式梯度采样纹理.' },
  { name: 'textureProj', signature: 'vec4 textureProj(sampler2D s, vec3 uv)', description: '投影纹理查找.' },
  { name: 'textureProjLod', signature: 'vec4 textureProjLod(sampler2D s, vec3 uv, float lod)', description: '投影纹理查找 (指定 LOD).' },
  { name: 'texelFetch', signature: 'vec4 texelFetch(sampler2D s, ivec2 coord, int lod)', description: '获取单个纹素.' },
  { name: 'textureGather', signature: 'vec4 textureGather(sampler2D s, vec2 uv)', description: '获取四个纹素的单通道.' },

  // ─── 打包/解包函数 ───
  { name: 'packHalf2x16', signature: 'uint packHalf2x16(vec2 v)', description: '将两个半精度浮点数打包为 uint.' },
  { name: 'unpackHalf2x16', signature: 'vec2 unpackHalf2x16(uint v)', description: '从 uint 解包两个半精度浮点数.' },
  { name: 'packUnorm2x16', signature: 'uint packUnorm2x16(vec2 v)', description: '将两个归一化浮点数打包为 uint.' },
  { name: 'unpackUnorm2x16', signature: 'vec2 unpackUnorm2x16(uint v)', description: '从 uint 解包两个归一化浮点数.' },
  { name: 'packSnorm2x16', signature: 'uint packSnorm2x16(vec2 v)', description: '将两个有符号归一化浮点数打包为 uint.' },
  { name: 'unpackSnorm2x16', signature: 'vec2 unpackSnorm2x16(uint v)', description: '从 uint 解包两个有符号归一化浮点数.' },
  { name: 'packUnorm4x8', signature: 'uint packUnorm4x8(vec4 v)', description: '将四个归一化浮点数打包为 uint.' },
  { name: 'unpackUnorm4x8', signature: 'vec4 unpackUnorm4x8(uint v)', description: '从 uint 解包四个归一化浮点数.' },
  { name: 'packSnorm4x8', signature: 'uint packSnorm4x8(vec4 v)', description: '将四个有符号归一化浮点数打包为 uint.' },
  { name: 'unpackSnorm4x8', signature: 'vec4 unpackSnorm4x8(uint v)', description: '从 uint 解包四个有符号归一化浮点数.' },

  // ─── 位操作/整数函数 ───
  { name: 'bitCount', signature: 'int bitCount(int v)', description: '统计值为 1 的位数.' },
  { name: 'bitfieldExtract', signature: 'int bitfieldExtract(int v, int offset, int bits)', description: '提取位域.' },
  { name: 'bitfieldInsert', signature: 'int bitfieldInsert(int base, int insert, int offset, int bits)', description: '插入位域.' },
  { name: 'bitfieldReverse', signature: 'int bitfieldReverse(int v)', description: '反转位.' },
  { name: 'findLSB', signature: 'int findLSB(int v)', description: '查找最低有效位.' },
  { name: 'findMSB', signature: 'int findMSB(int v)', description: '查找最高有效位.' },

  // ─── 布尔向量函数 ───
  { name: 'lessThan', signature: 'bvec lessThan(T x, T y)', description: '逐分量小于比较.' },
  { name: 'greaterThan', signature: 'bvec greaterThan(T x, T y)', description: '逐分量大于比较.' },
  { name: 'lessThanEqual', signature: 'bvec lessThanEqual(T x, T y)', description: '逐分量小于等于比较.' },
  { name: 'greaterThanEqual', signature: 'bvec greaterThanEqual(T x, T y)', description: '逐分量大于等于比较.' },
  { name: 'equal', signature: 'bvec equal(T x, T y)', description: '逐分量相等比较.' },
  { name: 'notEqual', signature: 'bvec notEqual(T x, T y)', description: '逐分量不等比较.' },
  { name: 'any', signature: 'bool any(bvec x)', description: '任一分量为 true 则返回 true.' },
  { name: 'all', signature: 'bool all(bvec x)', description: '所有分量为 true 则返回 true.' },
  { name: 'not', signature: 'bvec not(bvec x)', description: '逐分量逻辑取反.' },

  // ─── 导数函数 (仅 fragment) ───
  { name: 'dFdx', signature: 'T dFdx(T p)', description: 'x 方向偏导数 (仅片段着色器).', context: ['fragment'] },
  { name: 'dFdy', signature: 'T dFdy(T p)', description: 'y 方向偏导数 (仅片段着色器).', context: ['fragment'] },
  { name: 'fwidth', signature: 'T fwidth(T p)', description: 'abs(dFdx(p)) + abs(dFdy(p)).', context: ['fragment'] },

  // ─── Godot 专用 ───
  { name: 'emit_subparticle', signature: 'bool emit_subparticle(mat4 xform, vec3 velocity, vec4 color, vec4 custom, uint flags)', description: '发射子粒子 (仅粒子着色器).', context: ['start', 'process'] },

  // ─── canvas_item SDF 函数 ───
  { name: 'texture_sdf', signature: 'float texture_sdf(vec2 sdf_pos)', description: '执行 SDF 纹理查找 (仅 canvas_item fragment/light).', context: ['fragment', 'light'] },
  { name: 'texture_sdf_normal', signature: 'vec2 texture_sdf_normal(vec2 sdf_pos)', description: '从 SDF 纹理计算法线 (仅 canvas_item fragment/light).', context: ['fragment', 'light'] },
  { name: 'sdf_to_screen_uv', signature: 'vec2 sdf_to_screen_uv(vec2 sdf_pos)', description: '将 SDF 转换为屏幕 UV (仅 canvas_item).', context: ['fragment', 'light'] },
  { name: 'screen_uv_to_sdf', signature: 'vec2 screen_uv_to_sdf(vec2 uv)', description: '将屏幕 UV 转换为 SDF (仅 canvas_item).', context: ['fragment', 'light'] },
];
