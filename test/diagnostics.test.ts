/**
 * 诊断器逻辑测试
 * 不依赖 VS Code API, 直接测试诊断逻辑.
 *
 * 由于 DiagnosticsProvider 依赖 vscode 模块, 这里提取并测试其核心逻辑:
 * stripComments, 上下文检测, 以及基于纯文本的检查规则.
 */
import { describe, it, assert, summary } from './harness';
import {
  SHADER_TYPES, BUILTIN_VARS, PROCESSOR_FUNCTIONS,
  PROCESSOR_FUNCTION_INFO,
} from '../src/data';

// ─── 辅助函数: 从 diagnosticsProvider 提取的纯逻辑 ───

/** 去除行注释和行内块注释 */
function stripComments(line: string): string {
  let result = line.replace(/\/\*.*?\*\//g, '');
  const idx = result.indexOf('//');
  if (idx !== -1) {
    result = result.substring(0, idx);
  }
  return result;
}

/** 检测 shader_type */
function detectShaderType(text: string): string {
  const match = text.match(/shader_type\s+(spatial|canvas_item|particles|sky|fog)\s*;/);
  return match ? match[1] : 'spatial';
}

/** 检测指定行所处的处理器函数 (简化版, 用行数组) */
function detectFunctionAtLine(lines: string[], lineIdx: number): string {
  let braceDepth = 0;
  for (let i = lineIdx; i >= 0; i--) {
    const line = stripComments(lines[i]);
    for (let j = line.length - 1; j >= 0; j--) {
      if (line[j] === '}') braceDepth++;
      if (line[j] === '{') braceDepth--;
    }
    // 当遇到一个未配对的 '{' 时, 检查该行是否为处理器函数
    // 如果不是, 说明在某个语句块内 (if/for/while), 继续往上找
    if (braceDepth < 0) {
      const fnMatch = line.match(/void\s+(vertex|fragment|light|start|process|sky|fog)\s*\(/);
      if (fnMatch) return fnMatch[1];
      // 不是函数定义, 重置到 0 继续向上搜索
      braceDepth = 0;
    }
  }
  return '';
}

/** 检查内置变量是否在当前上下文中只读 */
function isBuiltinReadOnly(shaderType: string, fn: string, varName: string): boolean | null {
  const vars = BUILTIN_VARS[shaderType]?.[fn];
  if (!vars) return null;
  const v = vars.find(bv => bv.name === varName);
  if (!v) return null;
  return v.access === 'in';
}

console.log('\n=== 诊断器逻辑测试 ===');

// ─── stripComments ───

describe('stripComments', () => {
  it('应去除行注释', () => {
    assert.equal(stripComments('int a = 1; // comment').trim(), 'int a = 1;');
  });

  it('应去除行内块注释', () => {
    assert.equal(stripComments('int a = /* val */ 1;').trim(), 'int a =  1;');
  });

  it('空行应返回空字符串', () => {
    assert.equal(stripComments('').trim(), '');
  });

  it('纯注释行应返回空', () => {
    assert.equal(stripComments('// this is a comment').trim(), '');
  });

  it('多个行内块注释应全部去除', () => {
    assert.equal(stripComments('a /* x */ + /* y */ b').trim(), 'a  +  b');
  });

  it('不应影响无注释的行', () => {
    assert.equal(stripComments('float x = 3.14;'), 'float x = 3.14;');
  });
});

// ─── detectShaderType ───

describe('detectShaderType', () => {
  it('应检测 spatial', () => {
    assert.equal(detectShaderType('shader_type spatial;'), 'spatial');
  });

  it('应检测 canvas_item', () => {
    assert.equal(detectShaderType('shader_type canvas_item;'), 'canvas_item');
  });

  it('应检测 particles', () => {
    assert.equal(detectShaderType('shader_type particles;'), 'particles');
  });

  it('应检测 sky', () => {
    assert.equal(detectShaderType('shader_type sky;\nvoid sky() {}'), 'sky');
  });

  it('应检测 fog', () => {
    assert.equal(detectShaderType('shader_type fog;'), 'fog');
  });

  it('缺少 shader_type 时默认 spatial', () => {
    assert.equal(detectShaderType('void fragment() {}'), 'spatial');
  });

  it('shader_type 前有空白应仍能检测', () => {
    assert.equal(detectShaderType('  shader_type spatial ;'), 'spatial');
  });

  it('无效类型应默认 spatial', () => {
    assert.equal(detectShaderType('shader_type invalid;'), 'spatial');
  });
});

// ─── detectFunctionAtLine ───

describe('detectFunctionAtLine', () => {
  it('应检测 vertex 函数内的行', () => {
    const lines = [
      'shader_type spatial;',
      'void vertex() {',
      '  VERTEX.y += 1.0;',
      '}',
    ];
    assert.equal(detectFunctionAtLine(lines, 2), 'vertex');
  });

  it('应检测 fragment 函数内的行', () => {
    const lines = [
      'shader_type spatial;',
      'void vertex() {',
      '  VERTEX.y += 1.0;',
      '}',
      'void fragment() {',
      '  ALBEDO = vec3(1.0);',
      '}',
    ];
    assert.equal(detectFunctionAtLine(lines, 5), 'fragment');
  });

  it('应检测 light 函数内的行', () => {
    const lines = [
      'shader_type spatial;',
      'void light() {',
      '  DIFFUSE_LIGHT = vec3(1.0);',
      '}',
    ];
    assert.equal(detectFunctionAtLine(lines, 2), 'light');
  });

  it('函数外的行应返回空字符串', () => {
    const lines = [
      'shader_type spatial;',
      'uniform float speed;',
    ];
    assert.equal(detectFunctionAtLine(lines, 1), '');
  });

  it('应检测 start 函数', () => {
    const lines = [
      'shader_type particles;',
      'void start() {',
      '  COLOR = vec4(1.0);',
      '}',
    ];
    assert.equal(detectFunctionAtLine(lines, 2), 'start');
  });

  it('应检测 process 函数', () => {
    const lines = [
      'shader_type particles;',
      'void process() {',
      '  VELOCITY.y -= 9.8 * DELTA;',
      '}',
    ];
    assert.equal(detectFunctionAtLine(lines, 2), 'process');
  });

  it('应检测 sky 函数', () => {
    const lines = [
      'shader_type sky;',
      'void sky() {',
      '  COLOR = vec3(0.5);',
      '}',
    ];
    assert.equal(detectFunctionAtLine(lines, 2), 'sky');
  });

  it('应检测 fog 函数', () => {
    const lines = [
      'shader_type fog;',
      'void fog() {',
      '  DENSITY = 1.0;',
      '}',
    ];
    assert.equal(detectFunctionAtLine(lines, 2), 'fog');
  });

  it('嵌套大括号内应仍检测到正确的函数', () => {
    const lines = [
      'void fragment() {',
      '  if (true) {',
      '    ALBEDO = vec3(1.0);',
      '  }',
      '}',
    ];
    assert.equal(detectFunctionAtLine(lines, 2), 'fragment');
  });
});

// ─── 内置变量只读检查 ───

describe('内置变量只读检查', () => {
  it('spatial.vertex.MODEL_MATRIX 应为只读', () => {
    assert.equal(isBuiltinReadOnly('spatial', 'vertex', 'MODEL_MATRIX'), true);
  });

  it('spatial.vertex.VERTEX 应为可写 (inout)', () => {
    assert.equal(isBuiltinReadOnly('spatial', 'vertex', 'VERTEX'), false);
  });

  it('spatial.fragment.ALBEDO 应为可写 (out)', () => {
    assert.equal(isBuiltinReadOnly('spatial', 'fragment', 'ALBEDO'), false);
  });

  it('spatial.fragment.FRAGCOORD 应为只读', () => {
    assert.equal(isBuiltinReadOnly('spatial', 'fragment', 'FRAGCOORD'), true);
  });

  it('spatial.light.NORMAL 应为只读', () => {
    assert.equal(isBuiltinReadOnly('spatial', 'light', 'NORMAL'), true);
  });

  it('spatial.light.DIFFUSE_LIGHT 应为可写', () => {
    assert.equal(isBuiltinReadOnly('spatial', 'light', 'DIFFUSE_LIGHT'), false);
  });

  it('canvas_item.fragment.COLOR 应为可写 (inout)', () => {
    assert.equal(isBuiltinReadOnly('canvas_item', 'fragment', 'COLOR'), false);
  });

  it('canvas_item.light.COLOR 应为只读', () => {
    assert.equal(isBuiltinReadOnly('canvas_item', 'light', 'COLOR'), true);
  });

  it('fog.fog.DENSITY 应为可写', () => {
    assert.equal(isBuiltinReadOnly('fog', 'fog', 'DENSITY'), false);
  });

  it('fog.fog.WORLD_POSITION 应为只读', () => {
    assert.equal(isBuiltinReadOnly('fog', 'fog', 'WORLD_POSITION'), true);
  });

  it('未知变量应返回 null', () => {
    assert.equal(isBuiltinReadOnly('spatial', 'vertex', 'NOT_A_REAL_VAR'), null);
  });
});

// ─── 处理器函数约束 ───

describe('处理器函数约束检查', () => {
  it('vertex 不属于 particles/sky/fog', () => {
    for (const st of ['particles', 'sky', 'fog'] as const) {
      assert.ok(
        !PROCESSOR_FUNCTIONS[st].includes('vertex' as any),
        `vertex 不应属于 ${st}`
      );
    }
  });

  it('start/process 仅属于 particles', () => {
    assert.ok(PROCESSOR_FUNCTIONS.particles.includes('start'));
    assert.ok(PROCESSOR_FUNCTIONS.particles.includes('process'));
    assert.ok(!PROCESSOR_FUNCTIONS.spatial.includes('start' as any));
    assert.ok(!PROCESSOR_FUNCTIONS.spatial.includes('process' as any));
  });

  it('sky() 仅属于 sky', () => {
    assert.ok(PROCESSOR_FUNCTIONS.sky.includes('sky'));
    assert.ok(!PROCESSOR_FUNCTIONS.spatial.includes('sky' as any));
  });

  it('fog() 仅属于 fog', () => {
    assert.ok(PROCESSOR_FUNCTIONS.fog.includes('fog'));
    assert.ok(!PROCESSOR_FUNCTIONS.spatial.includes('fog' as any));
  });
});

// ─── discard 位置检查 ───

describe('discard 位置规则', () => {
  it('fragment 应允许 discard', () => {
    const info = PROCESSOR_FUNCTION_INFO.find(p => p.name === 'fragment');
    assert.ok(info?.allowDiscard);
  });

  it('light 应允许 discard', () => {
    const info = PROCESSOR_FUNCTION_INFO.find(p => p.name === 'light');
    assert.ok(info?.allowDiscard);
  });

  it('vertex 不应允许 discard', () => {
    const info = PROCESSOR_FUNCTION_INFO.find(p => p.name === 'vertex');
    assert.ok(!info?.allowDiscard);
  });

  it('start 不应允许 discard', () => {
    const info = PROCESSOR_FUNCTION_INFO.find(p => p.name === 'start');
    assert.ok(!info?.allowDiscard);
  });

  it('sky 不应允许 discard', () => {
    const info = PROCESSOR_FUNCTION_INFO.find(p => p.name === 'sky');
    assert.ok(!info?.allowDiscard);
  });

  it('fog 不应允许 discard', () => {
    const info = PROCESSOR_FUNCTION_INFO.find(p => p.name === 'fog');
    assert.ok(!info?.allowDiscard);
  });
});

process.exit(summary());
