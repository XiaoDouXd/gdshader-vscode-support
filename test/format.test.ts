/**
 * 格式化器测试
 * 验证基于 token 流的缩进计算与文档注释对齐.
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, assert, summary } from './harness';
import { Lexer } from '../src/parser/lexer';
import { computeFormatEdits } from '../src/providers/formattingProvider-core';
import { TokenType } from '../src/parser/token';

const FIXTURES = path.resolve(__dirname, '../../test/fixtures');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

/** 对源文本执行格式化, 返回格式化后的完整文本 (使用 \n 行尾) */
function format(src: string, insertSpaces = true, tabSize = 2): string {
  const lines = src.split(/\r?\n/);
  const edits = computeFormatEdits(src, lines, insertSpaces, tabSize);
  for (const e of edits) lines[e.line] = e.text;
  return lines.join('\n');
}

/** 断言格式化后某行内容 */
function assertLine(result: string, line: number, expected: string, msg?: string): void {
  const lines = result.split('\n');
  assert.equal(lines[line], expected, msg ?? `第 ${line} 行不匹配:\n  实际:   ${JSON.stringify(lines[line])}\n  期望: ${JSON.stringify(expected)}`);
}

console.log('\n=== 格式化器测试 ===');

// ═══════════════════════════════════════════
// Lexer trivia (注释 token)
// ═══════════════════════════════════════════

describe('Lexer - 注释 token (includeTrivia)', () => {
  it('应产出行注释 token', () => {
    const tokens = new Lexer('a // c\nb', { includeTrivia: true }).tokenize();
    const c = tokens.find(t => t.type === TokenType.LineComment);
    assert.ok(c, '未找到行注释 token');
    assert.ok(c!.value.startsWith('//'));
  });

  it('应产出块注释 token', () => {
    const tokens = new Lexer('a /* c */ b', { includeTrivia: true }).tokenize();
    const c = tokens.find(t => t.type === TokenType.BlockComment);
    assert.ok(c, '未找到块注释 token');
    assert.includes(c!.value, '/*');
    assert.includes(c!.value, '*/');
  });

  it('应区分文档注释与普通块注释', () => {
    const tokens = new Lexer('/** doc */\n/* plain */', { includeTrivia: true }).tokenize();
    const doc = tokens.find(t => t.type === TokenType.DocComment);
    const plain = tokens.find(t => t.type === TokenType.BlockComment);
    assert.ok(doc, '未识别出文档注释');
    assert.ok(plain, '未识别出普通块注释');
  });

  it('默认 (无 includeTrivia) 仍跳过注释', () => {
    const tokens = new Lexer('a // c\nb').tokenize();
    assert.equal(tokens.filter(t => t.type === TokenType.LineComment).length, 0);
  });

  it('块注释 value 应跨多行', () => {
    const src = '/*\n * a\n */';
    const tokens = new Lexer(src, { includeTrivia: true }).tokenize();
    const c = tokens.find(t => t.type === TokenType.BlockComment)!;
    assert.equal(c.line, 0);
    // 含 3 行 -> 2 个换行
    assert.equal(c.value.split('\n').length, 3);
  });
});

// ═══════════════════════════════════════════
// 基本缩进
// ═══════════════════════════════════════════

describe('格式化 - 基本缩进', () => {
  it('应规范化函数体缩进', () => {
    const src = 'shader_type spatial;\nvoid fragment() {\nCOLOR = vec4(1.0);\n}';
    const out = format(src);
    assertLine(out, 2, '  COLOR = vec4(1.0);');
  });

  it('应处理 if/else 缩进', () => {
    const src = 'void f() {\nif (a) {\nb();\n} else {\nc();\n}\n}';
    const out = format(src);
    assertLine(out, 1, '  if (a) {');
    assertLine(out, 2, '    b();');
    assertLine(out, 3, '  } else {');
    assertLine(out, 4, '    c();');
    assertLine(out, 5, '  }');
    assertLine(out, 6, '}');
  });

  it('} else { 行应位于外层, 分支体回到内层', () => {
    const src = 'void f() {\n  if (a) {\n    b();\n  } else {\n    c();\n  }\n}';
    const out = format(src);
    // 已正确则不变
    assert.equal(out, src);
  });

  it('应支持 Tab 缩进', () => {
    const src = 'void f() {\nx;\n}';
    const out = format(src, false, 4);
    assertLine(out, 1, '\tx;');
  });
});

// ═══════════════════════════════════════════
// 注释与 token 流 (修复原 bug)
// ═══════════════════════════════════════════

describe('格式化 - 注释不干扰括号配对', () => {
  it('行尾 // 注释后的 { 仍应提升缩进', () => {
    const src = 'void f() { // 入口\nx;\n}';
    const out = format(src);
    assertLine(out, 0, 'void f() { // 入口');
    assertLine(out, 1, '  x;');
  });

  it('} else { 带行尾注释仍应正确配对', () => {
    const src = 'void f() {\n  if (a) {\n    b();\n  } else { // 分支\n    c();\n  }\n}';
    const out = format(src);
    assertLine(out, 3, '  } else { // 分支');
    assertLine(out, 4, '    c();');
  });

  it('空块 {} 不应被过度回退缩进', () => {
    const src = 'void f() {\n  {}\n  x;\n}';
    const out = format(src);
    // {} 与函数体内同级
    assertLine(out, 1, '  {}');
    assertLine(out, 2, '  x;');
  });

  it('块注释内部的 { } 不应影响缩进', () => {
    const src = '/* } { */\nvoid f() {\nx;\n}';
    const out = format(src);
    assertLine(out, 0, '/* } { */');
    assertLine(out, 2, '  x;');
    assertLine(out, 3, '}');
  });

  it('行注释内的 { } 不应影响缩进', () => {
    const src = 'void f() { // {\nx;\n}';
    const out = format(src);
    assertLine(out, 1, '  x;');
  });

  it('行注释行应缩进到当前层级', () => {
    const src = 'void f() {\n// 注释\nx;\n}';
    const out = format(src);
    assertLine(out, 1, '  // 注释');
    assertLine(out, 2, '  x;');
  });
});

// ═══════════════════════════════════════════
// 文档注释 (@param) 排版
// ═══════════════════════════════════════════

describe('格式化 - 文档注释对齐', () => {
  it('应保持 * 与 /** 的第二个 * 对齐', () => {
    const src = [
      '/**',
      ' * 描述.',
      ' * @param a 参数 a',
      ' * @param b 参数 b',
      ' */',
      'void f() {}',
    ].join('\n');
    const out = format(src);
    assertLine(out, 0, '/**');
    assertLine(out, 1, ' * 描述.');
    assertLine(out, 2, ' * @param a 参数 a');
    assertLine(out, 3, ' * @param b 参数 b');
    assertLine(out, 4, ' */');
  });

  it('应修复未对齐的文档注释', () => {
    // 缺少前导空格, * 紧贴缩进
    const src = [
      'void f() {',
      '/**',
      '* 描述.',
      '* @param a 参数',
      '*/',
      '}',
    ].join('\n');
    const out = format(src);
    // 函数体内 (level 1, 2 空格): /** 在 2 空格, 续行 * 在 3 空格
    assertLine(out, 1, '  /**');
    assertLine(out, 2, '   * 描述.');
    assertLine(out, 3, '   * @param a 参数');
    assertLine(out, 4, '   */');
  });

  it('普通块注释也应对齐', () => {
    const src = [
      '/*',
      '* 一行',
      '* 另一行',
      '*/',
    ].join('\n');
    const out = format(src);
    assertLine(out, 0, '/*');
    assertLine(out, 1, ' * 一行');
    assertLine(out, 2, ' * 另一行');
    assertLine(out, 3, ' */');
  });

  it('块注释内空行保留', () => {
    const src = ['/**', ' * 段落一', '', ' * 段落二', ' */'].join('\n');
    const out = format(src);
    assertLine(out, 1, ' * 段落一');
    assertLine(out, 2, '');
    assertLine(out, 3, ' * 段落二');
  });
});

// ═══════════════════════════════════════════
// 预处理器指令
// ═══════════════════════════════════════════

describe('格式化 - 预处理器指令', () => {
  it('顶层预处理器应保持在第 0 列', () => {
    const src = '  #include "a.gdshaderinc"\nshader_type spatial;';
    const out = format(src);
    assertLine(out, 0, '#include "a.gdshaderinc"');
  });

  it('多行预处理指令的续行应保留原样', () => {
    const src = '#define FOO \\\n    bar baz';
    const out = format(src);
    assertLine(out, 0, '#define FOO \\');
    assertLine(out, 1, '    bar baz');
  });
});

// ═══════════════════════════════════════════
// 幂等性 / 真实文件
// ═══════════════════════════════════════════

describe('格式化 - 幂等性', () => {
  it('已格式化的代码再次格式化应无变化', () => {
    const src = [
      'shader_type spatial;',
      '',
      'void fragment() {',
      '  ALBEDO = vec3(1.0);',
      '}',
    ].join('\n');
    const once = format(src);
    const twice = format(once);
    assert.equal(twice, once, '格式化非幂等');
  });

  it('doc-comments fixture 应幂等', () => {
    const src = readFixture('doc-comments.gdshader');
    const once = format(src);
    const twice = format(once);
    assert.equal(twice, once, 'doc-comments fixture 格式化非幂等');
  });

  for (const file of [
    'spatial-complete.gdshader',
    'canvas-item-complete.gdshader',
    'particles-complete.gdshader',
    'sky-complete.gdshader',
    'fog-complete.gdshader',
    'doc-comments.gdshader',
  ]) {
    it(`应幂等格式化 ${file}`, () => {
      const src = readFixture(file);
      const once = format(src);
      const twice = format(once);
      assert.equal(twice, once, `${file} 格式化非幂等`);
    });
  }

  it('格式化不应产生词法错误', () => {
    const src = readFixture('spatial-complete.gdshader');
    format(src); // 仅确保不抛异常
    const lexer = new Lexer(src, { includeTrivia: true });
    lexer.tokenize();
    assert.equal(lexer.diagnostics.length, 0, 'spatial-complete 有词法错误');
  });
});

process.exit(summary());
