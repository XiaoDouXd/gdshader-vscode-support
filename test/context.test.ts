/**
 * 上下文分析测试
 * 测试补全和悬停提供器中使用的上下文检测逻辑.
 * 不依赖 VS Code API.
 */
import { describe, it, assert, summary } from './harness';
import {
  SHADER_TYPES, RENDER_MODES, UNIFORM_HINTS,
  BUILTIN_VARS, BUILTIN_FUNCTIONS, PROCESSOR_FUNCTIONS,
  SYNTAX_FOLLOW_RULES,
} from '../src/data';

// ─── 从 providers 提取的纯逻辑函数 ───

/** 检测 shader_type */
function detectShaderType(text: string): string {
  const match = text.match(/shader_type\s+(spatial|canvas_item|particles|sky|fog)\s*;/);
  return match ? match[1] : 'spatial';
}

/** 检测光标所在的处理器函数 */
function detectCurrentFunction(lines: string[], cursorLine: number): string {
  for (let i = cursorLine; i >= 0; i--) {
    const match = lines[i].match(/void\s+(vertex|fragment|light|start|process|sky|fog)\s*\(/);
    if (match) return match[1];
  }
  return '';
}

/** 判断当前行是否在 shader_type 补全上下文中 */
function isShaderTypeContext(linePrefix: string): boolean {
  return /shader_type\s+\w*$/.test(linePrefix);
}

/** 判断当前行是否在 render_mode 补全上下文中 */
function isRenderModeContext(linePrefix: string): boolean {
  return /render_mode\s+[\w,\s]*$/.test(linePrefix);
}

/** 判断当前行是否在 uniform hint 补全上下文中 */
function isUniformHintContext(linePrefix: string): boolean {
  return /:\s*\w*$/.test(linePrefix) && /uniform\s+/.test(linePrefix);
}

/** 获取指定上下文可用的内置变量 */
function getContextVars(shaderType: string, fn: string) {
  return BUILTIN_VARS[shaderType]?.[fn] ?? [];
}

/** 按上下文过滤内置函数 */
function getContextFunctions(fn: string) {
  return BUILTIN_FUNCTIONS.filter(f => !f.context || f.context.includes(fn as any));
}

console.log('\n=== 上下文分析测试 ===');

// ─── shader_type 上下文 ───

describe('shader_type 补全上下文', () => {
  it('输入 "shader_type " 应匹配', () => {
    assert.ok(isShaderTypeContext('shader_type '));
  });

  it('输入 "shader_type sp" 应匹配', () => {
    assert.ok(isShaderTypeContext('shader_type sp'));
  });

  it('输入 "shader_type" (无空格) 不应匹配', () => {
    assert.ok(!isShaderTypeContext('shader_type'));
  });

  it('普通行不应匹配', () => {
    assert.ok(!isShaderTypeContext('uniform float'));
  });
});

// ─── render_mode 上下文 ───

describe('render_mode 补全上下文', () => {
  it('输入 "render_mode " 应匹配', () => {
    assert.ok(isRenderModeContext('render_mode '));
  });

  it('输入 "render_mode blend_mix, " 应匹配 (多值)', () => {
    assert.ok(isRenderModeContext('render_mode blend_mix, '));
  });

  it('输入 "render_mode blend_mix, un" 应匹配', () => {
    assert.ok(isRenderModeContext('render_mode blend_mix, un'));
  });

  it('普通行不应匹配', () => {
    assert.ok(!isRenderModeContext('float mode = 1.0'));
  });
});

// ─── uniform hint 上下文 ───

describe('uniform hint 补全上下文', () => {
  it('"uniform vec4 color : " 应匹配', () => {
    assert.ok(isUniformHintContext('uniform vec4 color : '));
  });

  it('"uniform float x : hint_" 应匹配', () => {
    assert.ok(isUniformHintContext('uniform float x : hint_'));
  });

  it('"float x : " 不应匹配 (非 uniform)', () => {
    assert.ok(!isUniformHintContext('float x : '));
  });

  it('"uniform float x" 不应匹配 (无冒号)', () => {
    assert.ok(!isUniformHintContext('uniform float x'));
  });
});

// ─── 处理器函数检测 ───

describe('处理器函数检测', () => {
  const spatialShader = [
    'shader_type spatial;',           // 0
    '',                               // 1
    'uniform float speed;',           // 2
    '',                               // 3
    'void vertex() {',                // 4
    '  VERTEX.y += sin(TIME);',       // 5
    '}',                              // 6
    '',                               // 7
    'void fragment() {',              // 8
    '  ALBEDO = vec3(1.0);',          // 9
    '  if (true) {',                  // 10
    '    ALPHA = 0.5;',               // 11
    '  }',                            // 12
    '}',                              // 13
    '',                               // 14
    'void light() {',                 // 15
    '  DIFFUSE_LIGHT = vec3(0.0);',   // 16
    '}',                              // 17
  ];

  it('全局作用域应返回空', () => {
    assert.equal(detectCurrentFunction(spatialShader, 2), '');
  });

  it('vertex 函数内应返回 vertex', () => {
    assert.equal(detectCurrentFunction(spatialShader, 5), 'vertex');
  });

  it('fragment 函数内应返回 fragment', () => {
    assert.equal(detectCurrentFunction(spatialShader, 9), 'fragment');
  });

  it('fragment 嵌套 if 内应仍返回 fragment', () => {
    assert.equal(detectCurrentFunction(spatialShader, 11), 'fragment');
  });

  it('light 函数内应返回 light', () => {
    assert.equal(detectCurrentFunction(spatialShader, 16), 'light');
  });
});

// ─── 内置变量上下文过滤 ───

describe('内置变量上下文过滤', () => {
  it('spatial.vertex 应包含 VERTEX 和 NORMAL', () => {
    const vars = getContextVars('spatial', 'vertex');
    assert.ok(vars.some(v => v.name === 'VERTEX'));
    assert.ok(vars.some(v => v.name === 'NORMAL'));
  });

  it('spatial.fragment 应包含 ALBEDO 但不包含 DIFFUSE_LIGHT', () => {
    const vars = getContextVars('spatial', 'fragment');
    assert.ok(vars.some(v => v.name === 'ALBEDO'));
    assert.ok(!vars.some(v => v.name === 'DIFFUSE_LIGHT'));
  });

  it('spatial.light 应包含 DIFFUSE_LIGHT 但不包含 ALBEDO 为 out', () => {
    const vars = getContextVars('spatial', 'light');
    const dl = vars.find(v => v.name === 'DIFFUSE_LIGHT');
    assert.ok(dl);
    assert.equal(dl!.access, 'out');
    const albedo = vars.find(v => v.name === 'ALBEDO');
    assert.ok(albedo);
    assert.equal(albedo!.access, 'in');
  });

  it('canvas_item.light 应包含 LIGHT (vec4, inout)', () => {
    const vars = getContextVars('canvas_item', 'light');
    const light = vars.find(v => v.name === 'LIGHT');
    assert.ok(light);
    assert.equal(light!.type, 'vec4');
    assert.equal(light!.access, 'inout');
  });

  it('particles.start 应包含 RESTART_POSITION', () => {
    const vars = getContextVars('particles', 'start');
    assert.ok(vars.some(v => v.name === 'RESTART_POSITION'));
  });

  it('particles.process 应包含 COLLIDED', () => {
    const vars = getContextVars('particles', 'process');
    assert.ok(vars.some(v => v.name === 'COLLIDED'));
  });

  it('particles.start 不应包含 COLLIDED (仅 process)', () => {
    const vars = getContextVars('particles', 'start');
    assert.ok(!vars.some(v => v.name === 'COLLIDED'));
  });

  it('sky.sky 应包含 EYEDIR 和 AT_CUBEMAP_PASS', () => {
    const vars = getContextVars('sky', 'sky');
    assert.ok(vars.some(v => v.name === 'EYEDIR'));
    assert.ok(vars.some(v => v.name === 'AT_CUBEMAP_PASS'));
  });

  it('fog.fog 应包含 UVW 和 SDF', () => {
    const vars = getContextVars('fog', 'fog');
    assert.ok(vars.some(v => v.name === 'UVW'));
    assert.ok(vars.some(v => v.name === 'SDF'));
  });

  it('未知函数应返回空数组', () => {
    const vars = getContextVars('spatial', 'nonexistent');
    assert.equal(vars.length, 0);
  });
});

// ─── 内置函数上下文过滤 ───

describe('内置函数上下文过滤', () => {
  it('fragment 上下文应包含 dFdx/dFdy/fwidth', () => {
    const fns = getContextFunctions('fragment');
    assert.ok(fns.some(f => f.name === 'dFdx'));
    assert.ok(fns.some(f => f.name === 'dFdy'));
    assert.ok(fns.some(f => f.name === 'fwidth'));
  });

  it('vertex 上下文不应包含 dFdx/dFdy (仅 fragment)', () => {
    const fns = getContextFunctions('vertex');
    assert.ok(!fns.some(f => f.name === 'dFdx'));
    assert.ok(!fns.some(f => f.name === 'dFdy'));
  });

  it('所有上下文都应包含通用函数 (sin, cos, texture)', () => {
    for (const ctx of ['vertex', 'fragment', 'light', 'start', 'process', 'sky', 'fog']) {
      const fns = getContextFunctions(ctx);
      assert.ok(fns.some(f => f.name === 'sin'), `${ctx} 缺少 sin`);
      assert.ok(fns.some(f => f.name === 'cos'), `${ctx} 缺少 cos`);
      assert.ok(fns.some(f => f.name === 'texture'), `${ctx} 缺少 texture`);
    }
  });

  it('emit_subparticle 应仅在 start/process 上下文中可用', () => {
    const startFns = getContextFunctions('start');
    const processFns = getContextFunctions('process');
    const vertexFns = getContextFunctions('vertex');
    assert.ok(startFns.some(f => f.name === 'emit_subparticle'));
    assert.ok(processFns.some(f => f.name === 'emit_subparticle'));
    assert.ok(!vertexFns.some(f => f.name === 'emit_subparticle'));
  });
});

// ─── 渲染模式过滤 ───

describe('渲染模式上下文过滤', () => {
  it('spatial 应包含 blend_mix', () => {
    assert.ok(RENDER_MODES.spatial.includes('blend_mix'));
  });

  it('spatial 不应包含 keep_data (仅 particles)', () => {
    assert.ok(!RENDER_MODES.spatial.includes('keep_data'));
  });

  it('particles 不应包含 blend_mix', () => {
    assert.ok(!RENDER_MODES.particles.includes('blend_mix'));
  });

  it('sky 应包含 use_half_res_pass', () => {
    assert.ok(RENDER_MODES.sky.includes('use_half_res_pass'));
  });

  it('fog 应为空数组', () => {
    assert.equal(RENDER_MODES.fog.length, 0);
  });
});

// ─── SYNTAX_FOLLOW_RULES 匹配测试 ───

describe('SYNTAX_FOLLOW_RULES 正则匹配', () => {
  const shaderTypeRule = SYNTAX_FOLLOW_RULES.find(r => r.trigger === 'shader_type')!;
  const renderModeRule = SYNTAX_FOLLOW_RULES.find(r => r.trigger === 'render_mode')!;
  const uniformHintRule = SYNTAX_FOLLOW_RULES.find(r => r.trigger === 'uniform_hint')!;

  it('shader_type 规则应匹配 "shader_type "', () => {
    assert.ok(shaderTypeRule.triggerPattern.test('shader_type '));
  });

  it('shader_type 规则应匹配 "shader_type spa"', () => {
    assert.ok(shaderTypeRule.triggerPattern.test('shader_type spa'));
  });

  it('render_mode 规则应匹配 "render_mode blend_mix, "', () => {
    assert.ok(renderModeRule.triggerPattern.test('render_mode blend_mix, '));
  });

  it('uniform_hint 规则应匹配 ": hint"', () => {
    assert.ok(uniformHintRule.triggerPattern.test('uniform float x : hint'));
  });
});

process.exit(summary());
