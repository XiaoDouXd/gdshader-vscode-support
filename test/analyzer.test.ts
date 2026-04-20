/**
 * Analyzer 测试
 * 测试符号表构建、作用域解析、重复定义/未定义变量检测.
 */
import { describe, it, assert, summary } from './harness';
import { parseShader } from '../src/parser/document-cache';
import { Analyzer, SymbolKind, Scope } from '../src/parser/analyzer';

// ═══════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════

function analyze(source: string) {
  const result = parseShader(source);
  const analyzer = new Analyzer();
  return analyzer.analyze(result.ast, source);
}

// ═══════════════════════════════════════════
// 测试套件
// ═══════════════════════════════════════════

describe('Analyzer - 全局作用域', () => {
  it('应收集 uniform 声明', () => {
    const r = analyze(`shader_type spatial;
uniform vec3 albedo;
uniform float roughness;
void fragment() {}`);
    const sym = r.globalScope.resolve('albedo');
    assert.ok(sym !== undefined, '应找到 albedo');
    assert.equal(sym!.kind, SymbolKind.Uniform, '应为 Uniform');
    assert.equal(sym!.typeName, 'vec3', '类型应为 vec3');
  });

  it('应收集 varying 声明', () => {
    const r = analyze(`shader_type spatial;
varying float my_var;
void vertex() {}`);
    const sym = r.globalScope.resolve('my_var');
    assert.ok(sym !== undefined, '应找到 my_var');
    assert.equal(sym!.kind, SymbolKind.Varying, '应为 Varying');
    assert.equal(sym!.typeName, 'float', '类型应为 float');
  });

  it('应收集全局 const 声明', () => {
    const r = analyze(`shader_type spatial;
const float PI2 = 6.28318;
void fragment() {}`);
    const sym = r.globalScope.resolve('PI2');
    assert.ok(sym !== undefined, '应找到 PI2');
    assert.equal(sym!.kind, SymbolKind.Constant, '应为 Constant');
    assert.equal(sym!.isConst, true, '应标记为 const');
  });

  it('应收集 struct 声明及成员', () => {
    const r = analyze(`shader_type spatial;
struct MyData {
  vec3 position;
  float weight;
};
void fragment() {}`);
    const sym = r.globalScope.resolve('MyData');
    assert.ok(sym !== undefined, '应找到 MyData');
    assert.equal(sym!.kind, SymbolKind.Struct, '应为 Struct');
    assert.ok(sym!.members !== undefined, '应有成员');
    assert.equal(sym!.members!.length, 2, '应有 2 个成员');
    assert.equal(sym!.members![0].name, 'position', '第一个成员名');
    assert.equal(sym!.members![0].typeName, 'vec3', '第一个成员类型');
    assert.ok(r.structs.has('MyData'), 'structs map 应有 MyData');
    assert.equal(r.structs.get('MyData')!.length, 2, 'structs map 成员数');
  });

  it('应收集函数声明和签名', () => {
    const r = analyze(`shader_type spatial;
float my_func(vec3 pos, float scale) {
  return length(pos) * scale;
}
void fragment() {}`);
    const sym = r.globalScope.resolve('my_func');
    assert.ok(sym !== undefined, '应找到 my_func');
    assert.equal(sym!.kind, SymbolKind.Function, '应为 Function');
    assert.equal(sym!.typeName, 'float', '返回类型应为 float');
    assert.ok(sym!.signature!.includes('vec3 pos'), '签名应含参数');
    assert.equal(sym!.parameters!.length, 2, '应有 2 个参数');
    assert.ok(r.functions.has('my_func'), 'functions map');
  });

  it('应注入内置常量', () => {
    const r = analyze(`shader_type spatial;\nvoid fragment() {}`);
    const pi = r.globalScope.resolve('PI');
    assert.ok(pi !== undefined, '应找到 PI');
    assert.equal(pi!.kind, SymbolKind.BuiltinConstant, '应为 BuiltinConstant');
  });

  it('应注入内置函数', () => {
    const r = analyze(`shader_type spatial;\nvoid fragment() {}`);
    const sin = r.globalScope.resolve('sin');
    assert.ok(sin !== undefined, '应找到 sin');
    assert.equal(sin!.kind, SymbolKind.BuiltinFunction, '应为 BuiltinFunction');
  });
});

describe('Analyzer - 函数作用域', () => {
  it('处理器函数应注入内置变量', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  ALBEDO = vec3(1.0);
}`);
    const scope = Analyzer.findScopeAtLine(r.globalScope, 2);
    const albedo = scope.resolve('ALBEDO');
    assert.ok(albedo !== undefined, '应找到 ALBEDO');
    assert.equal(albedo!.kind, SymbolKind.BuiltinVar, '应为 BuiltinVar');
    assert.equal(albedo!.access, 'out', 'ALBEDO 应为 out');
  });

  it('非处理器函数不应有内置变量', () => {
    const r = analyze(`shader_type spatial;
float helper() {
  return 1.0;
}
void fragment() {}`);
    const scope = Analyzer.findScopeAtLine(r.globalScope, 2);
    const albedo = scope.resolve('ALBEDO');
    assert.ok(albedo === undefined, 'helper() 不应有 ALBEDO');
  });

  it('函数参数应在函数作用域中可见', () => {
    const r = analyze(`shader_type spatial;
float calc(vec3 pos, float scale) {
  return length(pos) * scale;
}
void fragment() {}`);
    const scope = Analyzer.findScopeAtLine(r.globalScope, 2);
    const pos = scope.resolve('pos');
    assert.ok(pos !== undefined, '应找到参数 pos');
    assert.equal(pos!.kind, SymbolKind.Parameter, '应为 Parameter');
    assert.equal(pos!.typeName, 'vec3', '参数类型应为 vec3');
  });

  it('局部变量应在块作用域中可见', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = 1.0;
  vec3 color = vec3(x);
}`);
    const scope = Analyzer.findScopeAtLine(r.globalScope, 3);
    const x = scope.resolve('x');
    assert.ok(x !== undefined, '应找到变量 x');
    assert.equal(x!.kind, SymbolKind.Variable, '应为 Variable');
    assert.equal(x!.typeName, 'float', '类型应为 float');
  });

  it('for 循环变量应在 for 作用域中可见', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  for (int i = 0; i < 10; i++) {
    float val = float(i);
  }
}`);
    const scope = Analyzer.findScopeAtLine(r.globalScope, 3);
    const i = scope.resolve('i');
    assert.ok(i !== undefined, '应找到循环变量 i');
    assert.equal(i!.typeName, 'int', '类型应为 int');
  });
});

describe('Analyzer - 重复定义检测', () => {
  it('应检测全局变量重复定义', () => {
    const r = analyze(`shader_type spatial;
uniform float x;
uniform float x;
void fragment() {}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义'));
    assert.ok(dupes.length >= 1, '应有重复定义诊断');
  });

  it('应检测局部变量重复定义', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = 1.0;
  float x = 2.0;
}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义'));
    assert.ok(dupes.length >= 1, '应有重复定义诊断');
  });

  it('应检测参数重复定义', () => {
    const r = analyze(`shader_type spatial;
float f(float a, float a) {
  return a;
}
void fragment() {}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义'));
    assert.ok(dupes.length >= 1, '应有参数重复定义诊断');
  });

  it('应检测函数重复定义', () => {
    const r = analyze(`shader_type spatial;
float f(float a) { return a; }
float f(float b) { return b; }
void fragment() {}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义'));
    assert.ok(dupes.length >= 1, '应有函数重复定义诊断');
  });

  it('应检测 struct 成员重复', () => {
    const r = analyze(`shader_type spatial;
struct S {
  float x;
  float x;
};
void fragment() {}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义'));
    assert.ok(dupes.length >= 1, '应有 struct 成员重复定义诊断');
  });

  it('不同作用域的同名变量不应报重复', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = 1.0;
  if (true) {
    float x = 2.0;
  }
}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义'));
    assert.equal(dupes.length, 0, '不同作用域不应报重复');
  });
});

describe('Analyzer - 局部变量重复定义 (边界)', () => {
  it('同一函数体内连续声明同名变量应报重复', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float a = 1.0;
  float a = 2.0;
}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义') && d.message.includes('"a"'));
    assert.ok(dupes.length >= 1, `应检测到 a 重复定义 (got ${dupes.length}), diags: ${JSON.stringify(r.diagnostics.map(d=>d.message))}`);
  });

  it('同一函数体内声明三个同名变量应报两次重复', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  int v = 1;
  int v = 2;
  int v = 3;
}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义') && d.message.includes('"v"'));
    assert.ok(dupes.length >= 2, `应检测到至少 2 次 v 重复 (got ${dupes.length})`);
  });

  it('不同类型的同名变量也应报重复', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = 1.0;
  vec3 x = vec3(1.0);
}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义') && d.message.includes('"x"'));
    assert.ok(dupes.length >= 1, `不同类型但同名也应报重复 (got ${dupes.length})`);
  });

  it('局部变量与参数同名应报遮蔽 warning', () => {
    const r = analyze(`shader_type spatial;
float f(float x) {
  float x = 2.0;
  return x;
}`);
    const shadows = r.diagnostics.filter(d => d.message.includes('遮蔽') && d.message.includes('"x"'));
    assert.ok(shadows.length >= 1, `应检测到参数遮蔽 warning (got ${shadows.length})`);
    assert.equal(shadows[0].severity, 'warning', '应为 warning');
  });

  it('for 循环内重复声明循环变量是合法 shadow (不报错)', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  for (int i = 0; i < 10; i++) {
    int i = 5;
  }
}`);
    const errors = r.diagnostics.filter(d => d.severity === 'error' && d.message.includes('"i"'));
    assert.equal(errors.length, 0, 'for 循环 shadow 是合法的');
  });

  it('非处理器函数内连续声明同名变量应报重复', () => {
    const r = analyze(`shader_type spatial;
float helper() {
  float val = 1.0;
  float val = 2.0;
  return val;
}
void fragment() {}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义') && d.message.includes('"val"'));
    assert.ok(dupes.length >= 1, `helper() 内应检测到 val 重复 (got ${dupes.length})`);
  });

  it('嵌套 if 内不同块声明同名变量不应报重复', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  if (true) {
    float y = 1.0;
  } else {
    float y = 2.0;
  }
}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义') && d.message.includes('"y"'));
    assert.equal(dupes.length, 0, 'if/else 不同分支不应报重复');
  });

  it('同一 if 块内连续同名变量应报重复', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  if (true) {
    float z = 1.0;
    float z = 2.0;
  }
}`);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义') && d.message.includes('"z"'));
    assert.ok(dupes.length >= 1, `if 块内应检测到 z 重复 (got ${dupes.length})`);
  });
});

describe('Analyzer - 未定义标识符', () => {
  it('应检测未定义变量', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = undefined_var;
}`);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义'));
    assert.ok(undefs.length >= 1, '应有未定义标识符诊断');
  });

  it('不应报告已定义变量', () => {
    const r = analyze(`shader_type spatial;
uniform float brightness;
void fragment() {
  float x = brightness;
}`);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('brightness'));
    assert.equal(undefs.length, 0, '不应报告 brightness 未定义');
  });

  it('不应报告内置函数', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = sin(1.0);
}`);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('sin'));
    assert.equal(undefs.length, 0, '不应报告 sin 未定义');
  });

  it('不应报告内置常量', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = PI;
}`);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('PI'));
    assert.equal(undefs.length, 0, '不应报告 PI 未定义');
  });

  it('不应报告类型名', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  vec3 x = vec3(1.0);
}`);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('vec3'));
    assert.equal(undefs.length, 0, '不应报告 vec3 未定义');
  });

  it('不应报告内置变量', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  ALBEDO = vec3(1.0);
}`);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('ALBEDO'));
    assert.equal(undefs.length, 0, '不应报告 ALBEDO 未定义');
  });

  it('不应报告 struct 构造器', () => {
    const r = analyze(`shader_type spatial;
struct MyStruct {
  float x;
};
void fragment() {
  MyStruct s = MyStruct(1.0);
}`);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('MyStruct'));
    assert.equal(undefs.length, 0, '不应报告 MyStruct 未定义');
  });
});

describe('Analyzer - 作用域查询', () => {
  it('findScopeAtLine 应找到正确的作用域', () => {
    const r = analyze(`shader_type spatial;
uniform float u;
void fragment() {
  float x = 1.0;
  if (true) {
    float y = 2.0;
  }
}`);
    const globalScope = Analyzer.findScopeAtLine(r.globalScope, 1);
    assert.ok(globalScope.resolve('u') !== undefined, '全局应找到 u');

    const fnScope = Analyzer.findScopeAtLine(r.globalScope, 3);
    assert.ok(fnScope.resolve('x') !== undefined, '函数内应找到 x');
    assert.ok(fnScope.resolve('u') !== undefined, '函数内也应找到全局 u');
  });

  it('getVisibleSymbols 应返回所有可见符号', () => {
    const r = analyze(`shader_type spatial;
uniform float brightness;
void fragment() {
  float x = 1.0;
}`);
    const syms = Analyzer.getVisibleSymbolsAtLine(r.globalScope, 3);
    assert.ok(syms.has('brightness'), '应看到 brightness');
    assert.ok(syms.has('x'), '应看到 x');
    assert.ok(syms.has('PI'), '应看到内置常量 PI');
    assert.ok(syms.has('sin'), '应看到内置函数 sin');
    assert.ok(syms.has('ALBEDO'), '应看到内置变量 ALBEDO');
  });

  it('resolveAtLine 应正确解析标识符', () => {
    const r = analyze(`shader_type spatial;
float helper(float a) { return a; }
void fragment() {
  float x = helper(1.0);
}`);
    const helperSym = Analyzer.resolveAtLine(r.globalScope, 'helper', 3);
    assert.ok(helperSym !== undefined, '应解析到 helper');
    assert.equal(helperSym!.kind, SymbolKind.Function, '应为 Function');

    const xSym = Analyzer.resolveAtLine(r.globalScope, 'x', 3);
    assert.ok(xSym !== undefined, '应解析到 x');
    assert.equal(xSym!.typeName, 'float', 'x 类型应为 float');
  });
});

describe('Analyzer - Fixture 文件完整分析', () => {
  const fs = require('fs');
  const path = require('path');
  const FIXTURES = path.resolve(__dirname, '../../test/fixtures');

  const fixtureFiles = [
    'spatial-complete.gdshader',
    'canvas-item-complete.gdshader',
    'particles-complete.gdshader',
    'sky-complete.gdshader',
    'fog-complete.gdshader',
  ];

  for (const file of fixtureFiles) {
    it(`${file} 应无重复定义错误`, () => {
      const source = fs.readFileSync(path.join(FIXTURES, file), 'utf-8');
      const r = analyze(source);
      const errors = r.diagnostics.filter(d => d.severity === 'error');
      if (errors.length > 0) {
        console.log(`  ${file} 错误:`, errors.map(e => `L${e.line + 1}: ${e.message}`));
      }
      assert.equal(errors.length, 0, `${file} 不应有语义错误 (got ${errors.length})`);
    });
  }
});

// ═══════════════════════════════════════════
// Hint 注释 & #include 测试
// ═══════════════════════════════════════════

import { scanHints } from '../src/parser/hint-scanner';

describe('HintScanner - #include 检测', () => {
  it('应检测 res:// 路径的 include', () => {
    const r = scanHints(`shader_type spatial;
#include "res://shaders/utils.gdshaderinc"
void fragment() {}`);
    assert.equal(r.includes.length, 1, '应有 1 个 include');
    assert.ok(r.includes[0].isResPath, '应为 res:// 路径');
    assert.ok(!r.includes[0].isIgnored, '未被 ignore');
    assert.ok(r.hasUnresolvedResIncludes, '应有未解析的 res include');
  });

  it('应检测非 res:// 路径的 include', () => {
    const r = scanHints(`shader_type spatial;
#include "utils.gdshaderinc"
void fragment() {}`);
    assert.equal(r.includes.length, 1, '应有 1 个 include');
    assert.ok(!r.includes[0].isResPath, '不应为 res:// 路径');
    assert.ok(!r.hasUnresolvedResIncludes, '不应有未解析的 res include');
  });

  it('同行 // #gdshader-hint-ignore 应标记为 ignored', () => {
    const r = scanHints(`shader_type spatial;
#include "res://shaders/utils.gdshaderinc" // #gdshader-hint-ignore
void fragment() {}`);
    assert.equal(r.includes.length, 1);
    assert.ok(r.includes[0].isIgnored, '应被 ignore');
    assert.ok(!r.hasUnresolvedResIncludes, 'ignore 后不应有未解析的 res include');
  });

  it('下一行 // #gdshader-hint-ignore 应标记为 ignored', () => {
    const r = scanHints(`shader_type spatial;
#include "res://shaders/utils.gdshaderinc"
// #gdshader-hint-ignore
void fragment() {}`);
    assert.equal(r.includes.length, 1);
    assert.ok(r.includes[0].isIgnored, '应被 ignore');
  });

  it('同行 /* #gdshader-hint-ignore */ 应标记为 ignored', () => {
    const r = scanHints(`shader_type spatial;
#include "res://shaders/utils.gdshaderinc" /* #gdshader-hint-ignore */
void fragment() {}`);
    assert.ok(r.includes[0].isIgnored, '块注释形式 ignore');
  });
});

describe('HintScanner - #gdshader-hint-type', () => {
  it('应检测行注释形式的 type hint', () => {
    const r = scanHints(`shader_type spatial;
void fragment() {
  // #gdshader-hint-type:vec3
  float x;
}`);
    assert.equal(r.typeHints.length, 1);
    assert.equal(r.typeHints[0].typeName, 'vec3');
    assert.equal(r.typeHints[0].line, 2);
  });

  it('应检测块注释形式的 type hint', () => {
    const r = scanHints(`shader_type spatial;
float x; /* #gdshader-hint-type:mat4 */`);
    assert.equal(r.typeHints.length, 1);
    assert.equal(r.typeHints[0].typeName, 'mat4');
  });
});

describe('HintScanner - #gdshader-hint-def', () => {
  it('应解析函数定义', () => {
    const r = scanHints(`// #gdshader-hint-def:vec4 my_func(float p1, in float x);`);
    assert.equal(r.defHints.length, 1);
    const def = r.defHints[0];
    assert.equal(def.name, 'my_func');
    assert.equal(def.typeName, 'vec4');
    assert.ok(def.isFunction, '应为函数');
    assert.equal(def.parameters!.length, 2);
    assert.equal(def.parameters![0].name, 'p1');
    assert.equal(def.parameters![0].typeName, 'float');
    assert.equal(def.parameters![1].qualifier, 'in');
  });

  it('应解析变量定义', () => {
    const r = scanHints(`// #gdshader-hint-def:vec3 imported_color;`);
    assert.equal(r.defHints.length, 1);
    assert.equal(r.defHints[0].name, 'imported_color');
    assert.equal(r.defHints[0].typeName, 'vec3');
    assert.ok(!r.defHints[0].isFunction);
  });

  it('应解析块注释形式', () => {
    const r = scanHints(`/* #gdshader-hint-def:float helper(vec3 a) */`);
    assert.equal(r.defHints.length, 1);
    assert.equal(r.defHints[0].name, 'helper');
    assert.ok(r.defHints[0].isFunction);
  });
});

describe('Analyzer - #include + 未定义检查抑制', () => {
  it('有未 ignored 的 res:// include 时, 不应报未定义标识符', () => {
    const r = analyze(`shader_type spatial;
#include "res://shaders/utils.gdshaderinc"
void fragment() {
  float x = imported_function(1.0);
  vec3 c = IMPORTED_VAR;
}`);
    assert.ok(r.hasUnresolvedResIncludes, '应有未解析的 include');
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义'));
    assert.equal(undefs.length, 0, '不应报未定义');
  });

  it('ignored 的 res:// include 不应抑制未定义检查', () => {
    const r = analyze(`shader_type spatial;
#include "res://shaders/utils.gdshaderinc" // #gdshader-hint-ignore
void fragment() {
  float x = totally_unknown_func(1.0);
}`);
    assert.ok(!r.hasUnresolvedResIncludes, 'ignore 后不应有未解析的 include');
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义'));
    assert.ok(undefs.length >= 1, '应报未定义');
  });
});

describe('Analyzer - #gdshader-hint-def 注入', () => {
  it('hint-def 函数应可在分析中被 resolve', () => {
    const source = `shader_type spatial;
// #gdshader-hint-def:vec4 imported_func(float x);
void fragment() {
  vec4 c = imported_func(1.0);
}`;
    const r = analyze(source);
    const sym = Analyzer.resolveAtLine(r.globalScope, 'imported_func', 3);
    assert.ok(sym !== undefined, '应找到 imported_func');
    assert.equal(sym!.kind, SymbolKind.HintDefined, '应为 HintDefined');
    assert.equal(sym!.typeName, 'vec4');
    assert.ok(sym!.signature!.includes('imported_func'), '签名');
    // 不应有未定义警告
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('imported_func'));
    assert.equal(undefs.length, 0, '不应报 imported_func 未定义');
  });

  it('hint-def 变量应可在分析中被 resolve', () => {
    const source = `shader_type spatial;
// #gdshader-hint-def:vec3 imported_color;
void fragment() {
  ALBEDO = imported_color;
}`;
    const r = analyze(source);
    const sym = Analyzer.resolveAtLine(r.globalScope, 'imported_color', 3);
    assert.ok(sym !== undefined, '应找到 imported_color');
    assert.equal(sym!.typeName, 'vec3');
  });

  it('hint-def 不应影响重复定义检查', () => {
    const source = `shader_type spatial;
// #gdshader-hint-def:float helper;
float helper = 1.0;
void fragment() {}`;
    const r = analyze(source);
    const dupes = r.diagnostics.filter(d => d.message.includes('重复定义'));
    assert.equal(dupes.length, 0, 'hint-def 不参与重复定义检查');
  });
});

describe('Analyzer - #gdshader-hint-declare (新名称)', () => {
  it('应识别 #gdshader-hint-declare 函数定义', () => {
    const source = `shader_type spatial;
// #gdshader-hint-declare:vec4 my_func(float x);
void fragment() {
  vec4 c = my_func(1.0);
}`;
    const r = analyze(source);
    const sym = Analyzer.resolveAtLine(r.globalScope, 'my_func', 3);
    assert.ok(sym !== undefined, '应找到 my_func');
    assert.equal(sym!.kind, SymbolKind.HintDefined);
    assert.equal(sym!.typeName, 'vec4');
  });

  it('应同时兼容旧的 #gdshader-hint-def', () => {
    const r1 = scanHints(`// #gdshader-hint-declare:float new_var;`);
    const r2 = scanHints(`// #gdshader-hint-def:float old_var;`);
    assert.equal(r1.defHints.length, 1, 'declare 应被识别');
    assert.equal(r2.defHints.length, 1, 'def 应被兼容');
    assert.equal(r1.defHints[0].name, 'new_var');
    assert.equal(r2.defHints[0].name, 'old_var');
  });
});

describe('Analyzer - #include redirection (非 res:// 路径)', () => {
  it('非 res:// include 带 redirection 时应识别 redirectPath', () => {
    const r = scanHints(`#include "x" // #gdshader-hint-redirection: ./actual.gdshaderinc`);
    assert.equal(r.includes.length, 1);
    assert.equal(r.includes[0].path, 'x');
    assert.equal(r.includes[0].isResPath, false);
    assert.equal(r.includes[0].redirectPath, './actual.gdshaderinc');
  });

  it('非 res:// include 带 redirection 不应标记为 hasUnresolvedResIncludes', () => {
    const r = scanHints(`#include "nonexistent" // #gdshader-hint-redirection: ./real.gdshaderinc`);
    assert.equal(r.hasUnresolvedResIncludes, false);
  });
});

describe('Analyzer - 类型推导与类型检查', () => {
  it('应检测变量初始化类型不匹配', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = vec3(1.0);
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('类型不匹配'));
    assert.ok(errs.length >= 1, '应报类型不匹配');
    assert.ok(errs[0].message.includes('vec3'), '应提到 vec3');
    assert.ok(errs[0].message.includes('float'), '应提到 float');
  });

  it('应检测赋值类型不匹配', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  vec3 v = vec3(1.0);
  float f = 1.0;
  f = v;
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('类型不匹配'));
    assert.ok(errs.length >= 1, '应报赋值类型不匹配');
  });

  it('相同类型赋值不应报错', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  vec3 a = vec3(1.0);
  vec3 b = a;
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('类型不匹配'));
    assert.equal(errs.length, 0, '同类型赋值不应报错');
  });

  it('compound 赋值 (+= 等) 不应报类型错误', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  ALBEDO += vec3(0.1);
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('类型不匹配'));
    assert.equal(errs.length, 0, '+= 不应报类型错误');
  });

  it('内置泛型函数调用结果赋值不应误报', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  float x = 0.5;
  float y = max(x, 0.0);
}`);
    const errs = r.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errs.length, 0, '泛型函数返回值赋值不应报错');
  });

  it('泛型函数结果参与运算后赋值不应误报', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  vec3 v = vec3(1.0);
  vec3 r = normalize(v) * 0.5;
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('类型不匹配'));
    assert.equal(errs.length, 0, 'normalize 返回泛型, 不应报错');
  });
});

describe('Analyzer - 函数参数类型检查', () => {
  it('应检测用户函数参数数量不匹配', () => {
    const r = analyze(`shader_type spatial;
float my_add(float a, float b) { return a + b; }
void fragment() {
  float x = my_add(1.0);
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('参数'));
    assert.ok(errs.length >= 1, '应报参数数量不匹配');
    assert.ok(errs[0].message.includes('2'), '应提到需要 2 个参数');
    assert.ok(errs[0].message.includes('1'), '应提到传入 1 个');
  });

  it('应检测用户函数参数类型不匹配', () => {
    const r = analyze(`shader_type spatial;
float helper(vec3 v) { return 1.0; }
void fragment() {
  float x = helper(1.0);
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('参数') && d.message.includes('类型不匹配'));
    assert.ok(errs.length >= 1, '应报参数类型不匹配');
  });

  it('参数类型匹配时不应报错', () => {
    const r = analyze(`shader_type spatial;
float helper(vec3 v) { return 1.0; }
void fragment() {
  float x = helper(vec3(1.0));
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('参数') && d.message.includes('类型'));
    assert.equal(errs.length, 0, '正确的参数类型不应报错');
  });

  it('不应检查内置泛型函数的参数类型', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  vec3 n = normalize(vec3(1.0, 0.0, 0.0));
  float d = dot(n, vec3(0.0, 1.0, 0.0));
}`);
    const errs = r.diagnostics.filter(d => d.message.includes('参数') && d.message.includes('类型'));
    assert.equal(errs.length, 0, '内置泛型函数不应检查参数类型');
  });
});

describe('Analyzer - struct 相关', () => {
  it('struct 成员应有 declLine 信息', () => {
    const r = analyze(`shader_type spatial;
struct MyData {
  vec3 position;
  float value;
};
void fragment() {}`);
    const members = r.structs.get('MyData');
    assert.ok(members !== undefined, '应找到 MyData struct');
    assert.equal(members!.length, 2);
    assert.equal(members![0].name, 'position');
    assert.ok(members![0].declLine !== undefined, 'position 应有 declLine');
    assert.equal(members![1].name, 'value');
    assert.ok(members![1].declLine !== undefined, 'value 应有 declLine');
  });

  it('struct 成员应捕获行尾注释', () => {
    const r = analyze(`shader_type spatial;
struct Light {
  vec3 pos; // 光源位置
  float intensity; // 强度
};
void fragment() {}`);
    const members = r.structs.get('Light');
    assert.ok(members !== undefined);
    assert.equal(members![0].comment, '光源位置');
    assert.equal(members![1].comment, '强度');
  });

  it('struct 变量声明应正确解析 (isVarDeclStart)', () => {
    const r = analyze(`shader_type spatial;
struct MyStruct {
  float val;
};
void fragment() {
  MyStruct s = MyStruct(1.0);
}`);
    const errs = r.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errs.length, 0, 'struct 变量声明不应有解析错误');
  });
});

describe('Analyzer - 函数文档注释', () => {
  it('应捕获 /// 文档注释', () => {
    const source = `shader_type spatial;
/// 计算两个向量的混合
/// @param a 第一个向量
/// @param b 第二个向量
/// @return 混合结果
vec3 my_blend(vec3 a, vec3 b) {
  return mix(a, b, 0.5);
}
void fragment() {}`;
    const r = analyze(source);
    const sym = Analyzer.resolveAtLine(r.globalScope, 'my_blend', 8);
    assert.ok(sym !== undefined, '应找到 my_blend');
    assert.ok(sym!.description !== undefined, '应有 description');
    assert.ok(sym!.description!.includes('计算两个向量的混合'), '应包含摘要');
    assert.ok(sym!.description!.includes('@param a'), '应包含 @param');
    assert.ok(sym!.description!.includes('@return'), '应包含 @return');
  });

  it('没有 /// 注释的函数不应有 description', () => {
    const source = `shader_type spatial;
vec3 plain_func(vec3 a) { return a; }
void fragment() {}`;
    const r = analyze(source);
    const sym = Analyzer.resolveAtLine(r.globalScope, 'plain_func', 2);
    assert.ok(sym !== undefined);
    assert.ok(sym!.description === undefined || sym!.description === null, '无注释函数不应有 description');
  });
});

describe('Parser - 死循环防护', () => {
  it('多余的 } 不应导致死循环', () => {
    // 如果此测试挂起, 说明死循环防护失败
    const source = `shader_type spatial;
}
void fragment() {}`;
    const result = parseShader(source);
    assert.ok(result.ast !== undefined, '应产出 AST');
  });

  it('连续错误 token 不应导致死循环', () => {
    const source = `shader_type spatial;
@@@ $$$ !!!
void fragment() {}`;
    const result = parseShader(source);
    assert.ok(result.ast !== undefined, '应产出 AST');
  });

  it('缺少 { 的 struct 不应导致死循环', () => {
    const source = `shader_type spatial;
struct Bad ;
void fragment() {}`;
    const result = parseShader(source);
    assert.ok(result.ast !== undefined, '应产出 AST');
  });
});

describe('Parser - 自增/自减运算符 (++/--)', () => {
  it('for 循环中 i++ 应正确解析', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  for (int i = 0; i < 10; i++) {}
}`);
    const parseErrs = parseShader(`shader_type spatial;
void fragment() {
  for (int i = 0; i < 10; i++) {}
}`).parserDiagnostics;
    assert.equal(parseErrs.length, 0, 'i++ 不应有解析错误');
  });

  it('for 循环中 --i 应正确解析', () => {
    const parseErrs = parseShader(`shader_type spatial;
void fragment() {
  for (int i = 10; i > 0; --i) {}
}`).parserDiagnostics;
    assert.equal(parseErrs.length, 0, '--i 不应有解析错误');
  });

  it('后缀 ++ 在表达式中应正确解析', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  int x = 0;
  x++;
  int y = x++;
}`);
    const errs = r.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errs.length, 0, '后缀 ++ 表达式不应有错误');
  });
});

describe('Analyzer - mat * vec 类型推导', () => {
  it('mat4 * vec4 应返回 vec4', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  mat4 proj;
  vec4 clip = proj * vec4(1.0, 0.0, 0.0, 1.0);
}`);
    const errs = r.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errs.length, 0, 'mat4 * vec4 → vec4, 赋给 vec4 不应报错');
  });

  it('mat3 * vec3 应返回 vec3', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  mat3 m;
  vec3 v = m * vec3(1.0);
}`);
    const errs = r.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errs.length, 0, 'mat3 * vec3 → vec3, 赋给 vec3 不应报错');
  });

  it('vec4 * mat4 应返回 vec4', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  mat4 m;
  vec4 v = vec4(1.0) * m;
}`);
    const errs = r.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errs.length, 0, 'vec4 * mat4 → vec4, 不应报错');
  });

  it('inv_proj * vec4(...) 链式使用不应报错', () => {
    const r = analyze(`shader_type spatial;
vec3 view_pos_from_depth(vec2 screen_uv, float raw_depth, mat4 inv_proj) {
  vec3 ndc = vec3(screen_uv * 2.0 - 1.0, raw_depth);
  vec4 view = inv_proj * vec4(ndc, 1.0);
  return view.xyz / view.w;
}`);
    const errs = r.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errs.length, 0, '典型 SSR 深度重建代码不应有类型错误');
  });
});

describe('Fixture - SSR V2 完整 shader', () => {
  it('SSR V2 fixture 应解析无错误', () => {
    const fs = require('fs');
    const path = require('path');
    const fixturesDir = path.resolve(__dirname, '../../test/fixtures');
    const src = fs.readFileSync(path.join(fixturesDir, 'ssr-v2.gdshader'), 'utf-8');
    const result = parseShader(src);
    assert.equal(result.parserDiagnostics.length, 0,
      'SSR V2 fixture 不应有解析错误: ' + result.parserDiagnostics.map(d => d.message).join('; '));
    assert.equal(result.lexerDiagnostics.length, 0,
      'SSR V2 fixture 不应有词法错误');
  });

  it('SSR V2 fixture 语义分析无严重错误', () => {
    const fs = require('fs');
    const path = require('path');
    const fixturesDir = path.resolve(__dirname, '../../test/fixtures');
    const src = fs.readFileSync(path.join(fixturesDir, 'ssr-v2.gdshader'), 'utf-8');
    const result = parseShader(src);
    const a = new Analyzer();
    const res = a.analyze(result.ast, src);
    const errors = res.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errors.length, 0,
      'SSR V2 fixture 不应有语义错误: ' + errors.map(e => `L${e.line+1}: ${e.message}`).join('; '));
  });
});

// ═══════════════════════════════════════════
// Bug 修复回归测试
// ═══════════════════════════════════════════

describe('Parser - 数组语法支持 (Bug 修复)', () => {
  it('应解析 C 风格数组变量声明 `int arr[5];`', () => {
    const r = parseShader(`shader_type spatial;
void fragment() {
  int arr[5];
  arr[0] = 1;
}`);
    assert.equal(r.parserDiagnostics.length, 0,
      '数组声明不应有解析错误: ' + r.parserDiagnostics.map(d => d.message).join('; '));
    const fn = r.ast.declarations[0] as any;
    const varDecl = fn.body.statements[0];
    assert.ok(varDecl.arraySize !== null, '应捕获 arraySize');
  });

  it('应解析类型前置数组声明 `int[5] arr;`', () => {
    const r = parseShader(`shader_type spatial;
void fragment() {
  int[5] arr;
}`);
    assert.equal(r.parserDiagnostics.length, 0,
      '类型前置数组不应有解析错误: ' + r.parserDiagnostics.map(d => d.message).join('; '));
  });

  it('应解析空维度数组声明 `int[] arr = int[](1,2,3);`', () => {
    const r = parseShader(`shader_type spatial;
void fragment() {
  int[] arr = int[](1, 2, 3);
}`);
    assert.equal(r.parserDiagnostics.length, 0,
      '空维度数组构造器不应有解析错误: ' + r.parserDiagnostics.map(d => d.message).join('; '));
  });

  it('应解析数组构造器 `float[3](1.0, 2.0, 3.0)`', () => {
    const r = parseShader(`shader_type spatial;
void fragment() {
  float arr[3] = float[3](1.0, 2.0, 3.0);
}`);
    assert.equal(r.parserDiagnostics.length, 0,
      '数组构造器不应有解析错误: ' + r.parserDiagnostics.map(d => d.message).join('; '));
  });

  it('应解析数组字面量初始化 `int arr[3] = { 1, 2, 3 };`', () => {
    const r = parseShader(`shader_type spatial;
void fragment() {
  int arr[3] = { 1, 2, 3 };
}`);
    assert.equal(r.parserDiagnostics.length, 0,
      '数组字面量不应有解析错误: ' + r.parserDiagnostics.map(d => d.message).join('; '));
  });

  it('应解析 C 风格数组参数 `void f(float arr[5])`', () => {
    const r = parseShader(`shader_type spatial;
float f(float arr[5]) {
  return arr[0];
}
void fragment() {}`);
    assert.equal(r.parserDiagnostics.length, 0,
      '数组参数不应有解析错误: ' + r.parserDiagnostics.map(d => d.message).join('; '));
    const fn = r.ast.declarations[0] as any;
    assert.ok(fn.parameters[0].arraySize !== null, '参数应有 arraySize');
  });

  it('应解析 uniform 数组 `uniform vec4 colors[4];`', () => {
    const r = parseShader(`shader_type spatial;
uniform vec4 colors[4];
void fragment() {}`);
    assert.equal(r.parserDiagnostics.length, 0);
    const u = r.ast.declarations[0] as any;
    assert.ok(u.arraySize !== null);
  });

  it('数组构造器语义分析不应误报未定义', () => {
    const r = analyze(`shader_type spatial;
void fragment() {
  int[] arr = int[](1, 2, 3);
  int x = arr[0];
}`);
    const errs = r.diagnostics.filter(d => d.severity === 'error');
    assert.equal(errs.length, 0,
      '数组相关代码不应有语义错误: ' + errs.map(e => `L${e.line+1}: ${e.message}`).join('; '));
  });
});

describe('DocumentManager - 嵌套 #include 递归处理 (Bug 修复)', () => {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { DocumentManager } = require('../src/providers/document-manager');

  function makeTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gdshader-test-'));
    return dir;
  }

  function cleanup(dir: string): void {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  function toUri(p: string): string {
    return 'file:///' + p.replace(/\\/g, '/');
  }

  it('嵌套 include 中的符号应可在主文件解析到', () => {
    const dir = makeTempDir();
    try {
      // 三层嵌套: main -> a.gdshaderinc -> b.gdshaderinc
      const bPath = path.join(dir, 'b.gdshaderinc');
      fs.writeFileSync(bPath, `vec3 from_b(vec3 x) { return x * 2.0; }\n`);
      const aPath = path.join(dir, 'a.gdshaderinc');
      fs.writeFileSync(aPath, `#include "b.gdshaderinc"\nvec3 from_a(vec3 x) { return from_b(x); }\n`);
      const mainPath = path.join(dir, 'main.gdshader');
      const mainSrc = `shader_type spatial;
#include "a.gdshaderinc"
void fragment() {
  vec3 r = from_a(vec3(1.0));
  vec3 r2 = from_b(vec3(1.0));
  ALBEDO = r + r2;
}`;
      fs.writeFileSync(mainPath, mainSrc);

      const dm = new DocumentManager();
      const info = dm.update(toUri(mainPath), mainSrc);
      // a 应能看到
      const fromA = info.analysis.globalScope.resolve('from_a');
      assert.ok(fromA !== undefined, '应找到 a.gdshaderinc 中的 from_a');
      // b 嵌套也应能看到 (这是之前的 bug)
      const fromB = info.analysis.globalScope.resolve('from_b');
      assert.ok(fromB !== undefined, '应找到嵌套 b.gdshaderinc 中的 from_b (递归 include)');

      // 诊断中不应报 from_b 未定义
      const undefs = info.analysis.diagnostics.filter((d: any) => d.message.includes('未定义') || d.message.toLowerCase().includes('undefined'));
      assert.equal(undefs.length, 0, '不应报嵌套 include 符号未定义');
    } finally {
      cleanup(dir);
    }
  });

  it('循环 include 不应导致无限递归', () => {
    const dir = makeTempDir();
    try {
      const aPath = path.join(dir, 'a.gdshaderinc');
      const bPath = path.join(dir, 'b.gdshaderinc');
      fs.writeFileSync(aPath, `#include "b.gdshaderinc"\nfloat fa() { return 1.0; }\n`);
      fs.writeFileSync(bPath, `#include "a.gdshaderinc"\nfloat fb() { return 2.0; }\n`);
      const mainPath = path.join(dir, 'main.gdshader');
      const mainSrc = `shader_type spatial;
#include "a.gdshaderinc"
void fragment() { float x = fa() + fb(); ALBEDO = vec3(x); }`;
      fs.writeFileSync(mainPath, mainSrc);

      const dm = new DocumentManager();
      // 若不防循环则会无限递归 -> 栈溢出; 这里仅期望不抛错并能找到两个符号
      const info = dm.update(toUri(mainPath), mainSrc);
      assert.ok(info.analysis.globalScope.resolve('fa') !== undefined, '应找到 fa');
      assert.ok(info.analysis.globalScope.resolve('fb') !== undefined, '应找到 fb');
    } finally {
      cleanup(dir);
    }
  });
});

describe('Lexer/Analyzer - 宏定义 #define 支持 (Bug 修复)', () => {
  it('Lexer 应正确处理多行 #define 续行符 (LF)', () => {
    const { Lexer } = require('../src/parser/lexer');
    const { TokenType } = require('../src/parser/token');
    const src = `#define MULTI(x) \\\n  ((x) + \\\n   (x) * 2)\nfloat f() { return 1.0; }\n`;
    const tokens = new Lexer(src).tokenize();
    // 第一个 token 应是 Preprocessor, 包含整个多行 #define
    assert.equal(tokens[0].type, TokenType.Preprocessor);
    assert.ok(tokens[0].value.includes('MULTI'));
    assert.ok(tokens[0].value.includes('(x) * 2'),
      '多行 #define 体应被合并到同一个 Preprocessor token 中, got: ' + JSON.stringify(tokens[0].value));
    // 之后应是 `float f() { return 1.0; }`
    assert.equal(tokens[1].type, TokenType.KwFloat);
  });

  it('Lexer 应正确处理多行 #define 续行符 (CRLF)', () => {
    const { Lexer } = require('../src/parser/lexer');
    const { TokenType } = require('../src/parser/token');
    const src = `#define MULTI(x) \\\r\n  ((x) + \\\r\n   (x) * 2)\r\nfloat f() { return 1.0; }\r\n`;
    const tokens = new Lexer(src).tokenize();
    assert.equal(tokens[0].type, TokenType.Preprocessor);
    assert.ok(tokens[0].value.includes('MULTI'));
    assert.ok(tokens[0].value.includes('(x) * 2'),
      'CRLF 换行下多行 #define 体也应被合并, got: ' + JSON.stringify(tokens[0].value));
    assert.equal(tokens[1].type, TokenType.KwFloat);
  });

  it('scanHints 应识别单行 #define 宏', () => {
    const { scanHints } = require('../src/parser/hint-scanner');
    const r = scanHints(`#define PI_2 6.28318\nfloat x = PI_2;`);
    assert.equal(r.macros.length, 1);
    assert.equal(r.macros[0].name, 'PI_2');
    assert.equal(r.macros[0].isFunction, false);
    assert.ok(r.macros[0].body.includes('6.28318'));
  });

  it('scanHints 应识别函数式 #define 宏', () => {
    const { scanHints } = require('../src/parser/hint-scanner');
    const r = scanHints(`#define MUL(a, b) ((a) * (b))\n`);
    assert.equal(r.macros.length, 1);
    assert.equal(r.macros[0].name, 'MUL');
    assert.equal(r.macros[0].isFunction, true);
    assert.equal(r.macros[0].parameters!.length, 2);
    assert.equal(r.macros[0].parameters![0], 'a');
    assert.equal(r.macros[0].parameters![1], 'b');
  });

  it('scanHints 应合并多行 #define', () => {
    const { scanHints } = require('../src/parser/hint-scanner');
    const r = scanHints(`#define MAT_ROW(i) \\\n  (row_##i * \\\n   col)\n`);
    assert.equal(r.macros.length, 1);
    assert.equal(r.macros[0].name, 'MAT_ROW');
    assert.ok(r.macros[0].body.includes('col'),
      '多行宏体应被合并, got: ' + r.macros[0].body);
  });

  it('Analyzer 应把 #define 常量宏注入为符号, 不报未定义', () => {
    const r = analyze(`shader_type spatial;
#define MAX_STEPS 64
void fragment() {
  int n = MAX_STEPS;
}`);
    const sym = r.globalScope.resolve('MAX_STEPS');
    assert.ok(sym !== undefined, '应解析到 MAX_STEPS 宏');
    assert.equal(sym!.kind, SymbolKind.Macro);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('MAX_STEPS'));
    assert.equal(undefs.length, 0, '不应报 MAX_STEPS 未定义');
  });

  it('Analyzer 应把函数式 #define 宏作为符号, 调用时不报未定义', () => {
    const r = analyze(`shader_type spatial;
#define SQR(x) ((x) * (x))
void fragment() {
  float y = SQR(2.0);
}`);
    const sym = r.globalScope.resolve('SQR');
    assert.ok(sym !== undefined, '应解析到 SQR 宏');
    assert.equal(sym!.kind, SymbolKind.Macro);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('SQR'));
    assert.equal(undefs.length, 0, '不应报 SQR 未定义');
  });

  it('Analyzer 应正确处理多行 #define 并注入为符号', () => {
    const r = analyze(`shader_type spatial;
#define WRAP(x) \\
  ((x) + \\
   1.0)
void fragment() {
  float y = WRAP(0.5);
}`);
    const sym = r.globalScope.resolve('WRAP');
    assert.ok(sym !== undefined, '多行宏 WRAP 应被解析');
    assert.equal(sym!.kind, SymbolKind.Macro);
    const undefs = r.diagnostics.filter(d => d.message.includes('未定义') && d.message.includes('WRAP'));
    assert.equal(undefs.length, 0, '不应报多行宏 WRAP 未定义');
  });
});

// 运行
process.exit(summary());
