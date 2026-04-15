/**
 * 轻量级测试运行器
 * 不依赖任何第三方测试框架, 纯 Node.js 运行.
 */

let _suiteName = '';
let _passed = 0;
let _failed = 0;
let _errors: string[] = [];

/** 定义测试套件 */
export function describe(name: string, fn: () => void): void {
  _suiteName = name;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('='.repeat(60));
  fn();
}

/** 定义单个测试 */
export function it(name: string, fn: () => void): void {
  try {
    fn();
    _passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e: any) {
    _failed++;
    const msg = `  \x1b[31m✗\x1b[0m ${name}\n    ${e.message}`;
    console.log(msg);
    _errors.push(`[${_suiteName}] ${name}: ${e.message}`);
  }
}

/** 断言: 相等 */
export function assertEqual<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    throw new Error(msg || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

/** 断言: 为真 */
export function assertTrue(value: boolean, msg?: string): void {
  if (!value) {
    throw new Error(msg || `Expected true, got false`);
  }
}

/** 断言: 为假 */
export function assertFalse(value: boolean, msg?: string): void {
  if (value) {
    throw new Error(msg || `Expected false, got true`);
  }
}

/** 断言: 包含 */
export function assertContains<T>(arr: T[], item: T, msg?: string): void {
  if (!arr.includes(item)) {
    throw new Error(msg || `Array does not contain ${JSON.stringify(item)}`);
  }
}

/** 断言: 不包含 */
export function assertNotContains<T>(arr: T[], item: T, msg?: string): void {
  if (arr.includes(item)) {
    throw new Error(msg || `Array should not contain ${JSON.stringify(item)}`);
  }
}

/** 断言: 大于 */
export function assertGreaterThan(actual: number, expected: number, msg?: string): void {
  if (actual <= expected) {
    throw new Error(msg || `Expected ${actual} > ${expected}`);
  }
}

/** 断言: 数组长度 */
export function assertLength(arr: any[], expected: number, msg?: string): void {
  if (arr.length !== expected) {
    throw new Error(msg || `Expected length ${expected}, got ${arr.length}`);
  }
}

/** 断言: 抛出异常 */
export function assertThrows(fn: () => void, msg?: string): void {
  try {
    fn();
    throw new Error(msg || 'Expected function to throw');
  } catch (e: any) {
    if (e.message === (msg || 'Expected function to throw')) throw e;
  }
}

/** 断言: 匹配正则 */
export function assertMatch(str: string, pattern: RegExp, msg?: string): void {
  if (!pattern.test(str)) {
    throw new Error(msg || `"${str}" does not match ${pattern}`);
  }
}

/** 打印测试汇总并退出 */
export function summary(): boolean {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  \x1b[32m${_passed} passed\x1b[0m, \x1b[31m${_failed} failed\x1b[0m`);
  if (_errors.length > 0) {
    console.log(`\n  Failures:`);
    for (const e of _errors) {
      console.log(`    \x1b[31m• ${e}\x1b[0m`);
    }
  }
  console.log('');
  return _failed === 0;
}

/** 重置计数器 (用于多文件运行) */
export function reset(): void {
  _passed = 0;
  _failed = 0;
  _errors = [];
}

/** 获取计数 */
export function getCounts(): { passed: number; failed: number } {
  return { passed: _passed, failed: _failed };
}
