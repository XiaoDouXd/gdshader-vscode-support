/**
 * 轻量测试框架
 * 不依赖任何外部测试库, 纯 Node.js 运行.
 */

let totalPassed = 0;
let totalFailed = 0;
let currentSuite = '';
const failures: { suite: string; name: string; error: string }[] = [];

/** 定义测试套件 */
export function describe(name: string, fn: () => void): void {
  currentSuite = name;
  console.log(`\n  ${name}`);
  fn();
}

/** 定义单个测试用例 */
export function it(name: string, fn: () => void): void {
  try {
    fn();
    totalPassed++;
    console.log(`    \x1b[32m✓\x1b[0m ${name}`);
  } catch (e: any) {
    totalFailed++;
    const msg = e?.message ?? String(e);
    failures.push({ suite: currentSuite, name, error: msg });
    console.log(`    \x1b[31m✗\x1b[0m ${name}`);
    console.log(`      \x1b[31m${msg}\x1b[0m`);
  }
}

/** 断言工具集 */
export const assert = {
  ok(value: unknown, msg?: string): void {
    if (!value) throw new Error(msg ?? `Expected truthy, got ${JSON.stringify(value)}`);
  },
  equal(actual: unknown, expected: unknown, msg?: string): void {
    if (actual !== expected) {
      throw new Error(msg ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  deepEqual(actual: unknown, expected: unknown, msg?: string): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(msg ?? `Deep equal failed:\n  actual:   ${a}\n  expected: ${b}`);
  },
  throws(fn: () => void, msg?: string): void {
    let threw = false;
    try { fn(); } catch { threw = true; }
    if (!threw) throw new Error(msg ?? 'Expected function to throw');
  },
  includes(haystack: string | unknown[], needle: unknown, msg?: string): void {
    if (typeof haystack === 'string') {
      if (!haystack.includes(needle as string)) {
        throw new Error(msg ?? `Expected "${haystack}" to include "${needle}"`);
      }
    } else {
      if (!haystack.includes(needle)) {
        throw new Error(msg ?? `Expected array to include ${JSON.stringify(needle)}`);
      }
    }
  },
  greaterThan(actual: number, expected: number, msg?: string): void {
    if (!(actual > expected)) {
      throw new Error(msg ?? `Expected ${actual} > ${expected}`);
    }
  },
};

/** 打印测试结果汇总, 返回 exit code */
export function summary(): number {
  console.log('\n  ─────────────────────────────');
  console.log(`  \x1b[32m${totalPassed} passing\x1b[0m`);
  if (totalFailed > 0) {
    console.log(`  \x1b[31m${totalFailed} failing\x1b[0m\n`);
    for (const f of failures) {
      console.log(`  \x1b[31m✗ [${f.suite}] ${f.name}\x1b[0m`);
      console.log(`    ${f.error}\n`);
    }
  } else {
    console.log('');
  }
  return totalFailed > 0 ? 1 : 0;
}

/** 重置计数器 (用于 run-all 中多文件运行) */
export function reset(): void {
  totalPassed = 0;
  totalFailed = 0;
  failures.length = 0;
  currentSuite = '';
}

export function getStats() {
  return { passed: totalPassed, failed: totalFailed, failures: [...failures] };
}
