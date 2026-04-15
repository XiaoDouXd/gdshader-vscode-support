/**
 * Lexer + Parser 测试
 * 使用 test/fixtures/ 下的真实 .gdshader 文件验证解析器.
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, assert, summary } from './harness';
import { Lexer } from '../src/parser/lexer';
import { Parser } from '../src/parser/parser';
import { parseShader, findNodeAtOffset, findEnclosingFunction } from '../src/parser/document-cache';
import { TokenType } from '../src/parser/token';
import { NodeKind } from '../src/parser/ast';

// 编译后 __dirname = out/test, fixtures 在项目根的 test/fixtures
const FIXTURES = path.resolve(__dirname, '../../test/fixtures');

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

console.log('\n=== Lexer + Parser 测试 ===');

// ═══════════════════════════════════════════
// Lexer 测试
// ═══════════════════════════════════════════

describe('Lexer - 基本 token 化', () => {
  it('应将空文件 token 化为 EOF', () => {
    const lexer = new Lexer('');
    const tokens = lexer.tokenize();
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, TokenType.EOF);
  });

  it('应识别 shader_type 关键字', () => {
    const tokens = new Lexer('shader_type spatial;').tokenize();
    assert.equal(tokens[0].type, TokenType.KwShaderType);
    assert.equal(tokens[1].type, TokenType.Identifier); // spatial 不是关键字 token
    assert.equal(tokens[1].value, 'spatial');
    assert.equal(tokens[2].type, TokenType.Semicolon);
  });

  it('应识别整数字面量', () => {
    const tokens = new Lexer('42').tokenize();
    assert.equal(tokens[0].type, TokenType.IntLiteral);
    assert.equal(tokens[0].value, '42');
  });

  it('应识别无符号整数字面量', () => {
    const tokens = new Lexer('42u').tokenize();
    assert.equal(tokens[0].type, TokenType.UintLiteral);
  });

  it('应识别十六进制整数', () => {
    const tokens = new Lexer('0xFF').tokenize();
    assert.equal(tokens[0].type, TokenType.IntLiteral);
    assert.equal(tokens[0].value, '0xFF');
  });

  it('应识别浮点数', () => {
    const tokens = new Lexer('3.14').tokenize();
    assert.equal(tokens[0].type, TokenType.FloatLiteral);
  });

  it('应识别科学计数法浮点数', () => {
    const tokens = new Lexer('1e-3').tokenize();
    assert.equal(tokens[0].type, TokenType.FloatLiteral);
  });

  it('应识别带 f 后缀的浮点数', () => {
    const tokens = new Lexer('1.0f').tokenize();
    assert.equal(tokens[0].type, TokenType.FloatLiteral);
  });

  it('应识别布尔字面量', () => {
    const tokens = new Lexer('true false').tokenize();
    assert.equal(tokens[0].type, TokenType.BoolLiteral);
    assert.equal(tokens[1].type, TokenType.BoolLiteral);
  });

  it('应识别字符串字面量', () => {
    const tokens = new Lexer('"hello.gdshaderinc"').tokenize();
    assert.equal(tokens[0].type, TokenType.StringLiteral);
  });

  it('应识别类型关键字', () => {
    const tokens = new Lexer('vec3 mat4 sampler2D').tokenize();
    assert.equal(tokens[0].type, TokenType.KwVec3);
    assert.equal(tokens[1].type, TokenType.KwMat4);
    assert.equal(tokens[2].type, TokenType.KwSampler2D);
  });

  it('应识别复合运算符', () => {
    const tokens = new Lexer('+= -= *= == != <= >= && || << >>').tokenize();
    assert.equal(tokens[0].type, TokenType.PlusAssign);
    assert.equal(tokens[1].type, TokenType.MinusAssign);
    assert.equal(tokens[2].type, TokenType.StarAssign);
    assert.equal(tokens[3].type, TokenType.EqualEqual);
    assert.equal(tokens[4].type, TokenType.BangEqual);
    assert.equal(tokens[5].type, TokenType.LessEqual);
    assert.equal(tokens[6].type, TokenType.GreaterEqual);
    assert.equal(tokens[7].type, TokenType.AmpAmp);
    assert.equal(tokens[8].type, TokenType.PipePipe);
    assert.equal(tokens[9].type, TokenType.LShift);
    assert.equal(tokens[10].type, TokenType.RShift);
  });

  it('应跳过行注释', () => {
    const tokens = new Lexer('a // comment\nb').tokenize();
    assert.equal(tokens[0].type, TokenType.Identifier);
    assert.equal(tokens[0].value, 'a');
    assert.equal(tokens[1].type, TokenType.Identifier);
    assert.equal(tokens[1].value, 'b');
  });

  it('应跳过块注释', () => {
    const tokens = new Lexer('a /* comment */ b').tokenize();
    assert.equal(tokens[0].value, 'a');
    assert.equal(tokens[1].value, 'b');
  });

  it('应识别预处理器指令', () => {
    const tokens = new Lexer('#include "test.gdshaderinc"\nvoid f() {}').tokenize();
    assert.equal(tokens[0].type, TokenType.Preprocessor);
    assert.ok(tokens[0].value.includes('#include'));
  });

  it('应正确追踪行号', () => {
    const tokens = new Lexer('a\nb\nc').tokenize();
    assert.equal(tokens[0].line, 0);
    assert.equal(tokens[1].line, 1);
    assert.equal(tokens[2].line, 2);
  });
});

describe('Lexer - 真实着色器文件', () => {
  it('应成功 token 化 spatial-complete.gdshader', () => {
    const src = readFixture('spatial-complete.gdshader');
    const lexer = new Lexer(src);
    const tokens = lexer.tokenize();
    assert.greaterThan(tokens.length, 50);
    assert.equal(tokens[tokens.length - 1].type, TokenType.EOF);
    assert.equal(lexer.diagnostics.length, 0);
  });

  it('应成功 token 化所有 fixture 文件', () => {
    for (const file of ['canvas-item-complete.gdshader', 'particles-complete.gdshader',
      'sky-complete.gdshader', 'fog-complete.gdshader']) {
      const src = readFixture(file);
      const lexer = new Lexer(src);
      lexer.tokenize();
      assert.equal(lexer.diagnostics.length, 0, `${file} 有 lexer 错误`);
    }
  });
});

// ═══════════════════════════════════════════
// Parser 测试
// ═══════════════════════════════════════════

describe('Parser - 基本解析', () => {
  it('应解析 shader_type 声明', () => {
    const { ast } = parseShader('shader_type spatial;');
    assert.ok(ast.shaderType);
    assert.equal(ast.shaderType!.typeName.value, 'spatial');
  });

  it('应解析 render_mode 声明', () => {
    const { ast } = parseShader('shader_type spatial;\nrender_mode blend_mix, unshaded;');
    assert.ok(ast.renderMode);
    assert.equal(ast.renderMode!.modes.length, 2);
    assert.equal(ast.renderMode!.modes[0].value, 'blend_mix');
    assert.equal(ast.renderMode!.modes[1].value, 'unshaded');
  });

  it('应解析 uniform 声明', () => {
    const { ast } = parseShader('shader_type spatial;\nuniform float speed = 1.0;');
    assert.equal(ast.declarations.length, 1);
    assert.equal(ast.declarations[0].kind, NodeKind.UniformDecl);
  });

  it('应解析带 hint 的 uniform', () => {
    const { ast } = parseShader('shader_type spatial;\nuniform float x : hint_range(0.0, 1.0) = 0.5;');
    const u = ast.declarations[0] as any;
    assert.equal(u.kind, NodeKind.UniformDecl);
    assert.equal(u.hints.length, 1);
    assert.equal(u.hints[0].name.value, 'hint_range');
    assert.equal(u.hints[0].args.length, 2);
  });

  it('应解析 varying 声明', () => {
    const { ast } = parseShader('shader_type spatial;\nvarying vec3 color;');
    assert.equal(ast.declarations[0].kind, NodeKind.VaryingDecl);
  });

  it('应解析 const 声明', () => {
    const { ast } = parseShader('shader_type spatial;\nconst float PI2 = 6.28;');
    assert.equal(ast.declarations[0].kind, NodeKind.VariableDecl);
    assert.equal((ast.declarations[0] as any).isConst, true);
  });

  it('应解析 struct 声明', () => {
    const { ast } = parseShader('shader_type spatial;\nstruct Light {\n  vec3 pos;\n  float intensity;\n};');
    assert.equal(ast.declarations[0].kind, NodeKind.StructDecl);
    assert.equal((ast.declarations[0] as any).members.length, 2);
  });

  it('应解析 group_uniforms', () => {
    const { ast } = parseShader('shader_type spatial;\ngroup_uniforms MyGroup;');
    assert.equal(ast.declarations[0].kind, NodeKind.GroupUniformsDecl);
    assert.equal((ast.declarations[0] as any).groupName.value, 'MyGroup');
  });

  it('应解析预处理器指令', () => {
    const { ast } = parseShader('shader_type spatial;\n#include "test.gdshaderinc"');
    assert.equal(ast.declarations[0].kind, NodeKind.PreprocessorDirective);
  });
});

describe('Parser - 函数声明', () => {
  it('应解析空函数', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid vertex() {\n}');
    assert.equal(ast.declarations.length, 1);
    const fn = ast.declarations[0] as any;
    assert.equal(fn.kind, NodeKind.FunctionDecl);
    assert.equal(fn.name.value, 'vertex');
    assert.equal(fn.isProcessorFunction, true);
    assert.ok(fn.body);
  });

  it('应解析带参数的函数', () => {
    const { ast } = parseShader('shader_type spatial;\nvec3 myFunc(float a, in vec3 b) {\n  return a * b;\n}');
    const fn = ast.declarations[0] as any;
    assert.equal(fn.parameters.length, 2);
    assert.equal(fn.parameters[0].name.value, 'a');
    assert.equal(fn.parameters[1].qualifiers.length, 1);
  });

  it('非处理器函数应标记为 false', () => {
    const { ast } = parseShader('shader_type spatial;\nfloat helper() { return 0.0; }');
    assert.equal((ast.declarations[0] as any).isProcessorFunction, false);
  });
});

describe('Parser - 语句', () => {
  it('应解析 if/else 语句', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid fragment() {\n  if (true) {\n    ALBEDO = vec3(1.0);\n  } else {\n    ALBEDO = vec3(0.0);\n  }\n}');
    const fn = ast.declarations[0] as any;
    const ifStmt = fn.body.statements[0];
    assert.equal(ifStmt.kind, NodeKind.IfStmt);
    assert.ok(ifStmt.thenBranch);
    assert.ok(ifStmt.elseBranch);
  });

  it('应解析 for 循环', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid fragment() {\n  for (int i = 0; i < 10; i += 1) {\n    ALBEDO.r += 0.1;\n  }\n}');
    const fn = ast.declarations[0] as any;
    assert.equal(fn.body.statements[0].kind, NodeKind.ForStmt);
  });

  it('应解析 while 循环', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid fragment() {\n  while (true) {\n    break;\n  }\n}');
    const fn = ast.declarations[0] as any;
    assert.equal(fn.body.statements[0].kind, NodeKind.WhileStmt);
  });

  it('应解析 return 语句', () => {
    const { ast } = parseShader('shader_type spatial;\nfloat f() {\n  return 1.0;\n}');
    const fn = ast.declarations[0] as any;
    assert.equal(fn.body.statements[0].kind, NodeKind.ReturnStmt);
    assert.ok(fn.body.statements[0].value);
  });

  it('应解析空 return', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid f() {\n  return;\n}');
    const fn = ast.declarations[0] as any;
    assert.equal(fn.body.statements[0].kind, NodeKind.ReturnStmt);
    assert.equal(fn.body.statements[0].value, null);
  });

  it('应解析 discard', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid fragment() {\n  discard;\n}');
    const fn = ast.declarations[0] as any;
    assert.equal(fn.body.statements[0].kind, NodeKind.DiscardStmt);
  });
});

describe('Parser - 表达式', () => {
  it('应解析二元运算', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid f() {\n  float x = 1.0 + 2.0;\n}');
    const fn = ast.declarations[0] as any;
    const varDecl = fn.body.statements[0];
    assert.ok(varDecl.initializer);
    assert.equal(varDecl.initializer.kind, NodeKind.BinaryExpr);
  });

  it('应解析函数调用', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid f() {\n  float x = sin(1.0);\n}');
    const fn = ast.declarations[0] as any;
    const init = fn.body.statements[0].initializer;
    assert.equal(init.kind, NodeKind.CallExpr);
    assert.equal(init.args.length, 1);
  });

  it('应解析成员访问', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid f() {\n  float x = v.y;\n}');
    const fn = ast.declarations[0] as any;
    const init = fn.body.statements[0].initializer;
    assert.equal(init.kind, NodeKind.MemberExpr);
    assert.equal(init.member.value, 'y');
  });

  it('应解析数组索引', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid f() {\n  float x = arr[0];\n}');
    const fn = ast.declarations[0] as any;
    const init = fn.body.statements[0].initializer;
    assert.equal(init.kind, NodeKind.IndexExpr);
  });

  it('应解析三元运算', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid f() {\n  float x = true ? 1.0 : 0.0;\n}');
    const fn = ast.declarations[0] as any;
    const init = fn.body.statements[0].initializer;
    assert.equal(init.kind, NodeKind.TernaryExpr);
  });

  it('应解析类型构造器', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid f() {\n  vec3 v = vec3(1.0, 0.0, 0.0);\n}');
    const fn = ast.declarations[0] as any;
    const init = fn.body.statements[0].initializer;
    assert.equal(init.kind, NodeKind.CallExpr); // vec3(...) 解析为 call
    assert.equal(init.args.length, 3);
  });

  it('应解析赋值表达式', () => {
    const { ast } = parseShader('shader_type spatial;\nvoid fragment() {\n  ALBEDO = vec3(1.0);\n}');
    const fn = ast.declarations[0] as any;
    const stmt = fn.body.statements[0];
    assert.equal(stmt.kind, NodeKind.ExpressionStmt);
    assert.equal(stmt.expression.kind, NodeKind.AssignExpr);
  });
});

describe('Parser - 真实着色器文件', () => {
  const files = [
    'spatial-complete.gdshader',
    'canvas-item-complete.gdshader',
    'particles-complete.gdshader',
    'sky-complete.gdshader',
    'fog-complete.gdshader',
  ];

  for (const file of files) {
    it(`应成功解析 ${file}`, () => {
      const src = readFixture(file);
      const result = parseShader(src);
      assert.ok(result.ast);
      assert.equal(result.ast.kind, NodeKind.ShaderFile);
      assert.ok(result.ast.shaderType, `${file}: 缺少 shader_type`);
      assert.greaterThan(result.ast.declarations.length, 0, `${file}: 无声明`);
      // 检查无严重解析错误 (允许少量容错 diagnostic)
      const errorNodes = result.ast.declarations.filter(d => d.kind === NodeKind.ErrorNode);
      assert.equal(errorNodes.length, 0, `${file}: 有 ${errorNodes.length} 个 ErrorNode`);
    });
  }
});

describe('Parser - 容错', () => {
  it('应容错解析缺少 shader_type 的文件', () => {
    const { ast, parserDiagnostics } = parseShader('void fragment() {\n  ALBEDO = vec3(1.0);\n}');
    assert.equal(ast.shaderType, null);
    assert.greaterThan(ast.declarations.length, 0);
  });

  it('应容错解析有语法错误的文件', () => {
    const src = readFixture('errors-various.gdshader');
    const { ast } = parseShader(src);
    assert.ok(ast);
    assert.equal(ast.kind, NodeKind.ShaderFile);
  });
});

describe('findEnclosingFunction', () => {
  it('应找到光标所在的函数', () => {
    const src = 'shader_type spatial;\nvoid vertex() {\n  VERTEX.y += 1.0;\n}\nvoid fragment() {\n  ALBEDO = vec3(1.0);\n}';
    const { ast } = parseShader(src);
    const fn = findEnclosingFunction(ast, 2, 0);
    assert.ok(fn);
    assert.equal((fn as any).name.value, 'vertex');
  });

  it('应找到 fragment 函数', () => {
    const src = 'shader_type spatial;\nvoid vertex() {\n  VERTEX.y += 1.0;\n}\nvoid fragment() {\n  ALBEDO = vec3(1.0);\n}';
    const { ast } = parseShader(src);
    const fn = findEnclosingFunction(ast, 5, 0);
    assert.ok(fn);
    assert.equal((fn as any).name.value, 'fragment');
  });

  it('全局作用域应返回 null', () => {
    const src = 'shader_type spatial;\nuniform float x;';
    const { ast } = parseShader(src);
    const fn = findEnclosingFunction(ast, 1, 0);
    assert.equal(fn, null);
  });
});

process.exit(summary());
