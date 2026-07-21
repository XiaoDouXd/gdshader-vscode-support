/**
 * 测试运行器: 运行所有测试套件并汇总结果.
 */

interface SuiteResult {
  name: string;
  passed: number;
  failed: number;
  exitCode: number;
}

async function runSuite(name: string, modulePath: string): Promise<SuiteResult> {
  const { execSync } = await import('child_process');
  const path = await import('path');

  const scriptPath = path.resolve(__dirname, modulePath);
  try {
    const output = execSync(`node "${scriptPath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
    process.stdout.write(output);

    const passMatch = output.match(/(\d+) passing/);
    const failMatch = output.match(/(\d+) failing/);
    return {
      name,
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      exitCode: 0,
    };
  } catch (e: any) {
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);

    const output = (e.stdout ?? '') as string;
    const passMatch = output.match(/(\d+) passing/);
    const failMatch = output.match(/(\d+) failing/);
    return {
      name,
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      exitCode: e.status ?? 1,
    };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║    GDShader Support - 测试套件       ║');
  console.log('╚══════════════════════════════════════╝');

  const suites: [string, string][] = [
    ['数据层完整性', './data.test.js'],
    ['诊断器逻辑', './diagnostics.test.js'],
    ['上下文分析', './context.test.js'],
    ['Lexer + Parser', './parser.test.js'],
    ['Analyzer 语义分析', './analyzer.test.js'],
    ['格式化器', './format.test.js'],
  ];

  const results: SuiteResult[] = [];

  for (const [name, mod] of suites) {
    console.log(`\n━━━ ${name} ━━━`);
    results.push(await runSuite(name, mod));
  }

  // 汇总
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║           汇总结果                   ║');
  console.log('╠══════════════════════════════════════╣');

  let totalPassed = 0;
  let totalFailed = 0;

  for (const r of results) {
    const status = r.failed === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    console.log(`║ ${status} ${r.name.padEnd(20)} ${String(r.passed).padStart(3)} passed, ${String(r.failed).padStart(3)} failed ║`);
    totalPassed += r.passed;
    totalFailed += r.failed;
  }

  console.log('╠══════════════════════════════════════╣');
  const allStatus = totalFailed === 0 ? '\x1b[32mALL PASSED\x1b[0m' : '\x1b[31mFAILURES\x1b[0m';
  console.log(`║ ${allStatus}  Total: ${totalPassed} passed, ${totalFailed} failed     ║`);
  console.log('╚══════════════════════════════════════╝');

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
