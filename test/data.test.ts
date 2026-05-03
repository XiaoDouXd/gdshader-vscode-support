/**
 * 数据层完整性测试
 * 验证数据表的一致性, 完整性和正确性.
 */
import { describe, it, assert, summary } from './harness';
import {
  SHADER_TYPES, PROCESSOR_FUNCTIONS, ALL_TYPES,
  SCALAR_TYPES, VECTOR_TYPES, MATRIX_TYPES, SAMPLER_TYPES,
  ALL_KEYWORDS, CONTROL_KEYWORDS, STORAGE_QUALIFIERS,
  BUILTIN_CONSTANTS, CONSTANT_VALUES,
  RENDER_MODES, UNIFORM_HINTS, UNIFORM_HINT_DETAILS,
  BUILTIN_FUNCTIONS, BUILTIN_VARS,
  PROCESSOR_FUNCTION_INFO, SYNTAX_RULES, SYNTAX_FOLLOW_RULES,
} from '../src/data';

console.log('\n=== 数据层完整性测试 ===');

// ─── 着色器类型 ───

describe('SHADER_TYPES', () => {
  it('应包含 5 种着色器类型', () => {
    assert.equal(SHADER_TYPES.length, 5);
  });

  it('应包含所有必需类型', () => {
    for (const t of ['spatial', 'canvas_item', 'particles', 'sky', 'fog']) {
      assert.ok((SHADER_TYPES as readonly string[]).includes(t), `缺少 ${t}`);
    }
  });
});

// ─── 处理器函数 ───

describe('PROCESSOR_FUNCTIONS', () => {
  it('每种着色器类型都应有处理器函数定义', () => {
    for (const st of SHADER_TYPES) {
      assert.ok(PROCESSOR_FUNCTIONS[st], `${st} 缺少处理器函数定义`);
      assert.greaterThan(PROCESSOR_FUNCTIONS[st].length, 0, `${st} 处理器函数为空`);
    }
  });

  it('spatial 应有 vertex/fragment/light', () => {
    assert.deepEqual(PROCESSOR_FUNCTIONS.spatial, ['vertex', 'fragment', 'light']);
  });

  it('canvas_item 应有 vertex/fragment/light', () => {
    assert.deepEqual(PROCESSOR_FUNCTIONS.canvas_item, ['vertex', 'fragment', 'light']);
  });

  it('particles 应有 start/process', () => {
    assert.deepEqual(PROCESSOR_FUNCTIONS.particles, ['start', 'process']);
  });

  it('sky 应有 sky', () => {
    assert.deepEqual(PROCESSOR_FUNCTIONS.sky, ['sky']);
  });

  it('fog 应有 fog', () => {
    assert.deepEqual(PROCESSOR_FUNCTIONS.fog, ['fog']);
  });
});

// ─── 数据类型 ───

describe('类型系统', () => {
  it('ALL_TYPES 应等于各子类型的并集', () => {
    const expected = [...SCALAR_TYPES, ...VECTOR_TYPES, ...MATRIX_TYPES, ...SAMPLER_TYPES];
    assert.equal(ALL_TYPES.length, expected.length);
    for (const t of expected) {
      assert.ok(ALL_TYPES.includes(t), `ALL_TYPES 缺少 ${t}`);
    }
  });

  it('标量类型应包含 void/bool/int/uint/float', () => {
    for (const t of ['void', 'bool', 'int', 'uint', 'float']) {
      assert.ok((SCALAR_TYPES as readonly string[]).includes(t), `缺少 ${t}`);
    }
  });

  it('向量类型应有 12 种 (vec/bvec/ivec/uvec * 2/3/4)', () => {
    assert.equal(VECTOR_TYPES.length, 12);
  });

  it('矩阵类型应有 3 种', () => {
    assert.equal(MATRIX_TYPES.length, 3);
  });

  it('采样器类型应有 12 种', () => {
    assert.equal(SAMPLER_TYPES.length, 12);
  });

  it('类型名不应重复', () => {
    const seen = new Set<string>();
    for (const t of ALL_TYPES) {
      assert.ok(!seen.has(t), `类型 ${t} 重复`);
      seen.add(t);
    }
  });
});

// ─── 关键字 ───

describe('关键字', () => {
  it('ALL_KEYWORDS 应包含 shader_type 和 render_mode', () => {
    assert.ok(ALL_KEYWORDS.includes('shader_type'));
    assert.ok(ALL_KEYWORDS.includes('render_mode'));
  });

  it('控制流关键字应包含 if/else/for/while/return/discard', () => {
    for (const k of ['if', 'else', 'for', 'while', 'return', 'discard']) {
      assert.ok((CONTROL_KEYWORDS as readonly string[]).includes(k), `缺少 ${k}`);
    }
  });

  it('存储限定符应包含 uniform/varying/const/struct', () => {
    for (const k of ['uniform', 'varying', 'const', 'struct']) {
      assert.ok((STORAGE_QUALIFIERS as readonly string[]).includes(k), `缺少 ${k}`);
    }
  });

  it('关键字不应与类型名重叠', () => {
    for (const k of ALL_KEYWORDS) {
      assert.ok(!ALL_TYPES.includes(k), `关键字 ${k} 与类型名冲突`);
    }
  });
});

// ─── 常量 ───

describe('内置常量', () => {
  it('应包含 PI/TAU/E/INF/NAN', () => {
    for (const c of ['PI', 'TAU', 'E', 'INF', 'NAN']) {
      assert.ok((BUILTIN_CONSTANTS as readonly string[]).includes(c), `缺少 ${c}`);
    }
  });

  it('每个常量应有对应的值', () => {
    for (const c of BUILTIN_CONSTANTS) {
      assert.ok(CONSTANT_VALUES[c] !== undefined, `${c} 缺少值映射`);
    }
  });
});

// ─── 渲染模式 ───

describe('渲染模式', () => {
  it('每种着色器类型都应有渲染模式定义 (fog 可为空数组)', () => {
    for (const st of SHADER_TYPES) {
      assert.ok(RENDER_MODES[st] !== undefined, `${st} 缺少渲染模式定义`);
    }
  });

  it('spatial 应有最多渲染模式', () => {
    assert.greaterThan(RENDER_MODES.spatial.length, 20);
  });

  it('渲染模式名不应包含空格', () => {
    for (const [st, modes] of Object.entries(RENDER_MODES)) {
      for (const m of modes) {
        assert.ok(!m.includes(' '), `${st} 的渲染模式 "${m}" 包含空格`);
      }
    }
  });
});

// ─── Uniform 提示 ───

describe('Uniform 提示', () => {
  it('UNIFORM_HINTS 不应为空', () => {
    assert.greaterThan(UNIFORM_HINTS.length, 10);
  });

  it('UNIFORM_HINT_DETAILS 数量应与 UNIFORM_HINTS 一致', () => {
    assert.equal(UNIFORM_HINT_DETAILS.length, UNIFORM_HINTS.length);
  });

  it('每个 hint 都应有详细信息', () => {
    for (const h of UNIFORM_HINTS) {
      const detail = UNIFORM_HINT_DETAILS.find(d => d.name === h);
      assert.ok(detail, `hint ${h} 缺少详细信息`);
      assert.ok(detail!.description.length > 0, `hint ${h} 描述为空`);
      assert.greaterThan(detail!.applicableTypes.length, 0, `hint ${h} 适用类型为空`);
    }
  });
});

// ─── 内置函数 ───

describe('内置函数', () => {
  it('应有超过 70 个内置函数', () => {
    assert.greaterThan(BUILTIN_FUNCTIONS.length, 70);
  });

  it('每个函数应有名称, 签名和描述', () => {
    for (const fn of BUILTIN_FUNCTIONS) {
      assert.ok(fn.name.length > 0, '函数名为空');
      assert.ok(fn.signature.length > 0, `${fn.name} 签名为空`);
      assert.ok(fn.description.length > 0, `${fn.name} 描述为空`);
    }
  });

  it('函数名不应重复', () => {
    const seen = new Set<string>();
    for (const fn of BUILTIN_FUNCTIONS) {
      assert.ok(!seen.has(fn.name), `函数 ${fn.name} 重复`);
      seen.add(fn.name);
    }
  });

  it('签名应包含函数名', () => {
    for (const fn of BUILTIN_FUNCTIONS) {
      assert.ok(fn.signature.includes(fn.name), `${fn.name} 的签名不包含函数名`);
    }
  });

  it('签名应包含括号', () => {
    for (const fn of BUILTIN_FUNCTIONS) {
      assert.ok(fn.signature.includes('('), `${fn.name} 的签名缺少左括号`);
      assert.ok(fn.signature.includes(')'), `${fn.name} 的签名缺少右括号`);
    }
  });

  it('带上下文限制的函数应指定有效的处理器名', () => {
    const validContexts = ['vertex', 'fragment', 'light', 'start', 'process', 'sky', 'fog'];
    for (const fn of BUILTIN_FUNCTIONS) {
      if (fn.context) {
        for (const ctx of fn.context) {
          assert.ok(validContexts.includes(ctx), `${fn.name} 的上下文 ${ctx} 无效`);
        }
      }
    }
  });
});

// ─── 内置变量 ───

describe('内置变量', () => {
  it('BUILTIN_VARS 应覆盖所有 5 种着色器类型', () => {
    for (const st of SHADER_TYPES) {
      assert.ok(BUILTIN_VARS[st], `缺少 ${st} 的内置变量`);
    }
  });

  it('每种着色器的每个处理器函数都应有变量列表', () => {
    for (const st of SHADER_TYPES) {
      const processors = PROCESSOR_FUNCTIONS[st];
      for (const p of processors) {
        assert.ok(BUILTIN_VARS[st][p], `${st}.${p} 缺少内置变量列表`);
        assert.greaterThan(BUILTIN_VARS[st][p].length, 0, `${st}.${p} 变量列表为空`);
      }
    }
  });

  it('每个变量应有完整的字段', () => {
    for (const [st, procs] of Object.entries(BUILTIN_VARS)) {
      for (const [fn, vars] of Object.entries(procs)) {
        for (const v of vars) {
          assert.ok(v.name.length > 0, `${st}.${fn} 有空名变量`);
          assert.ok(v.type.length > 0, `${st}.${fn}.${v.name} 类型为空`);
          assert.ok(['in', 'out', 'inout'].includes(v.access), `${st}.${fn}.${v.name} access 无效: ${v.access}`);
          assert.ok(v.description.length > 0, `${st}.${fn}.${v.name} 描述为空`);
        }
      }
    }
  });

  it('所有处理器函数都应包含 TIME 变量', () => {
    for (const [st, procs] of Object.entries(BUILTIN_VARS)) {
      for (const [fn, vars] of Object.entries(procs)) {
        const hasTime = vars.some(v => v.name === 'TIME');
        assert.ok(hasTime, `${st}.${fn} 缺少 TIME 变量`);
      }
    }
  });

  it('spatial.fragment 应包含 ALBEDO/ALPHA/METALLIC/ROUGHNESS', () => {
    const vars = BUILTIN_VARS.spatial.fragment;
    for (const name of ['ALBEDO', 'ALPHA', 'METALLIC', 'ROUGHNESS']) {
      assert.ok(vars.some(v => v.name === name), `spatial.fragment 缺少 ${name}`);
    }
  });

  it('canvas_item.fragment 应包含 COLOR/TEXTURE/UV', () => {
    const vars = BUILTIN_VARS.canvas_item.fragment;
    for (const name of ['COLOR', 'TEXTURE', 'UV']) {
      assert.ok(vars.some(v => v.name === name), `canvas_item.fragment 缺少 ${name}`);
    }
  });

  it('particles.start 应包含 RESTART_POSITION', () => {
    const vars = BUILTIN_VARS.particles.start;
    assert.ok(vars.some(v => v.name === 'RESTART_POSITION'), 'particles.start 缺少 RESTART_POSITION');
  });

  it('sky.sky 应包含 EYEDIR/COLOR', () => {
    const vars = BUILTIN_VARS.sky.sky;
    for (const name of ['EYEDIR', 'COLOR']) {
      assert.ok(vars.some(v => v.name === name), `sky.sky 缺少 ${name}`);
    }
  });

  it('fog.fog 应包含 DENSITY/ALBEDO/EMISSION', () => {
    const vars = BUILTIN_VARS.fog.fog;
    for (const name of ['DENSITY', 'ALBEDO', 'EMISSION']) {
      assert.ok(vars.some(v => v.name === name), `fog.fog 缺少 ${name}`);
    }
  });

  it('变量名在同一处理器中不应重复', () => {
    for (const [st, procs] of Object.entries(BUILTIN_VARS)) {
      for (const [fn, vars] of Object.entries(procs)) {
        const seen = new Set<string>();
        for (const v of vars) {
          assert.ok(!seen.has(v.name), `${st}.${fn} 中变量 ${v.name} 重复`);
          seen.add(v.name);
        }
      }
    }
  });
});

// ─── 语法规则 ───

describe('处理器函数特化信息', () => {
  it('应包含所有 7 个处理器函数', () => {
    const names = PROCESSOR_FUNCTION_INFO.map(p => p.name);
    for (const fn of ['vertex', 'fragment', 'light', 'start', 'process', 'sky', 'fog']) {
      assert.ok(names.includes(fn as any), `缺少处理器函数 ${fn} 的信息`);
    }
  });

  it('discard 仅在 fragment/light 中允许', () => {
    for (const info of PROCESSOR_FUNCTION_INFO) {
      if (info.name === 'fragment' || info.name === 'light') {
        assert.ok(info.allowDiscard, `${info.name} 应允许 discard`);
      } else {
        assert.ok(!info.allowDiscard, `${info.name} 不应允许 discard`);
      }
    }
  });
});

describe('语法规则', () => {
  it('应定义多条语法规则', () => {
    assert.greaterThan(SYNTAX_RULES.length, 5);
  });

  it('每条规则应有 id 和描述', () => {
    for (const r of SYNTAX_RULES) {
      assert.ok(r.id.length > 0, '规则 id 为空');
      assert.ok(r.description.length > 0, `规则 ${r.id} 描述为空`);
    }
  });
});

describe('后续语法匹配规则', () => {
  it('应包含 shader_type/render_mode/uniform_hint 的规则', () => {
    const triggers = SYNTAX_FOLLOW_RULES.map(r => r.trigger);
    assert.ok(triggers.includes('shader_type'));
    assert.ok(triggers.includes('render_mode'));
    assert.ok(triggers.includes('uniform_hint'));
  });

  it('每条规则的 triggerPattern 应是有效正则', () => {
    for (const r of SYNTAX_FOLLOW_RULES) {
      assert.ok(r.triggerPattern instanceof RegExp, `${r.trigger} 的 triggerPattern 不是 RegExp`);
    }
  });
});

// ─── 本地化描述完整性 ───

describe('本地化描述 (Bug 修复: 内建关键字悬停本地化)', () => {
  const { locOptional } = require('../src/loc');

  it('每种 shader_type 都应有中/英描述', () => {
    for (const st of SHADER_TYPES) {
      const desc = locOptional(`desc.shaderType.${st}`);
      assert.ok(desc !== null && desc.length > 0, `shader_type ${st} 缺少描述`);
    }
  });

  it('每个类型都应有中/英描述', () => {
    for (const t of ALL_TYPES) {
      const desc = locOptional(`desc.type.${t}`);
      assert.ok(desc !== null && desc.length > 0, `类型 ${t} 缺少描述`);
    }
  });

  it('所有关键字 (除 true/false 文字字面量外) 都应有中/英描述', () => {
    for (const kw of ALL_KEYWORDS) {
      const desc = locOptional(`desc.keyword.${kw}`);
      assert.ok(desc !== null && desc.length > 0, `关键字 ${kw} 缺少描述`);
    }
  });

  it('每个 uniform hint 都应有中/英描述', () => {
    for (const hint of UNIFORM_HINTS) {
      const desc = locOptional(`desc.uniformHint.${hint}`);
      assert.ok(desc !== null && desc.length > 0, `uniform hint ${hint} 缺少描述`);
    }
  });

  it('uniform_hint 规则应匹配多 hint 场景 (Bug 修复)', () => {
    const rule = SYNTAX_FOLLOW_RULES.find(r => r.trigger === 'uniform_hint')!;
    // 基础: ": "
    assert.ok(rule.triggerPattern.test('uniform vec4 c : '), '空 hint 段应触发');
    // 正在输入首个 hint
    assert.ok(rule.triggerPattern.test('uniform vec4 c : hint'), '第一个 hint 应触发');
    // 已有首个 hint, 后续逗号
    assert.ok(rule.triggerPattern.test('uniform vec4 c : source_color, '), '逗号后应触发');
    // 已有带参数的 hint, 后续逗号
    assert.ok(rule.triggerPattern.test('uniform float x : hint_range(0, 1), '), '带参数 hint 后的逗号也应触发');
    // 已输入第二个 hint 的前缀
    assert.ok(rule.triggerPattern.test('uniform float x : hint_range(0, 1), filter_'), '正在输入第二个 hint 也应触发');
    // 在 "=" 之后不应触发 (默认值段)
    assert.ok(!rule.triggerPattern.test('uniform float x : hint_range(0, 1) = 0.5'), '= 后不应触发');
  });

  it('所有处理器函数均禁止 return (Bug 修复)', () => {
    for (const p of PROCESSOR_FUNCTION_INFO) {
      assert.equal(p.allowReturn, false, `${p.name} 应禁止 return`);
    }
  });
});

process.exit(summary());
