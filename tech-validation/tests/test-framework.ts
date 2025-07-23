/**
 * 轻量级测试框架
 */

import { logger } from '../utils/logger';

export interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: Error;
  assertions: AssertionResult[];
}

export interface AssertionResult {
  description: string;
  passed: boolean;
  actual?: any;
  expected?: any;
  error?: string;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

/**
 * 测试运行器
 */
export class TestRunner {
  private suites: TestSuite[] = [];
  private currentTest: TestResult | null = null;

  /**
   * 描述测试套件
   */
  describe(suiteName: string, callback: () => void): void {
    const suite: TestSuite = {
      name: suiteName,
      tests: []
    };
    
    this.suites.push(suite);
    
    // 在套件上下文中执行测试定义
    const originalSuite = this.currentSuite;
    this.currentSuite = suite;
    callback();
    this.currentSuite = originalSuite;
  }

  /**
   * 定义单个测试
   */
  it(testName: string, testFn: () => Promise<void> | void): void {
    if (!this.currentSuite) {
      throw new Error('测试必须在 describe 块中定义');
    }

    const test: TestResult = {
      name: testName,
      status: 'skipped',
      duration: 0,
      assertions: []
    };

    this.currentSuite.tests.push(test);
    
    // 保存测试函数引用
    (test as any).testFn = testFn;
  }

  /**
   * 设置前置钩子
   */
  beforeEach(setupFn: () => Promise<void> | void): void {
    if (!this.currentSuite) {
      throw new Error('beforeEach 必须在 describe 块中调用');
    }
    this.currentSuite.setup = async () => {
      await Promise.resolve(setupFn());
    };
  }

  /**
   * 设置后置钩子
   */
  afterEach(teardownFn: () => Promise<void> | void): void {
    if (!this.currentSuite) {
      throw new Error('afterEach 必须在 describe 块中调用');
    }
    this.currentSuite.teardown = async () => {
      await Promise.resolve(teardownFn());
    };
  }

  /**
   * 运行所有测试
   */
  async run(): Promise<void> {
    console.log('\n🧪 开始运行测试套件\n');
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const startTime = Date.now();

    for (const suite of this.suites) {
      console.log(`\n📦 ${suite.name}`);
      
      for (const test of suite.tests) {
        totalTests++;
        
        // 运行前置钩子
        if (suite.setup) {
          await suite.setup();
        }

        // 设置当前测试上下文
        this.currentTest = test;
        
        try {
          const testStartTime = Date.now();
          await Promise.resolve((test as any).testFn());
          test.duration = Date.now() - testStartTime;
          
          // 检查所有断言是否通过
          const allPassed = test.assertions.every(a => a.passed);
          if (allPassed) {
            test.status = 'passed';
            passedTests++;
            console.log(`  ✅ ${test.name} (${test.duration}ms)`);
          } else {
            test.status = 'failed';
            failedTests++;
            console.log(`  ❌ ${test.name} (${test.duration}ms)`);
            this.printFailedAssertions(test);
          }
        } catch (error) {
          test.status = 'failed';
          test.error = error as Error;
          test.duration = Date.now() - (test as any).startTime;
          failedTests++;
          console.log(`  ❌ ${test.name} - ${error}`);
        }

        // 运行后置钩子
        if (suite.teardown) {
          await suite.teardown();
        }

        this.currentTest = null;
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\n📊 测试结果汇总`);
    console.log(`总计: ${totalTests} | 通过: ${passedTests} | 失败: ${failedTests}`);
    console.log(`总耗时: ${totalDuration}ms\n`);

    if (failedTests > 0) {
      process.exitCode = 1;
    }
  }

  /**
   * 打印失败的断言
   */
  private printFailedAssertions(test: TestResult): void {
    const failedAssertions = test.assertions.filter(a => !a.passed);
    for (const assertion of failedAssertions) {
      console.log(`    ⚠️  ${assertion.description}`);
      if (assertion.error) {
        console.log(`       ${assertion.error}`);
      }
      if (assertion.expected !== undefined && assertion.actual !== undefined) {
        console.log(`       期望: ${JSON.stringify(assertion.expected)}`);
        console.log(`       实际: ${JSON.stringify(assertion.actual)}`);
      }
    }
  }

  private currentSuite: TestSuite | null = null;
}

/**
 * 断言库
 */
export class Assert {
  constructor(private runner: TestRunner) {}

  /**
   * 断言相等
   */
  equal(actual: any, expected: any, message?: string): void {
    const description = message || `期望 ${actual} 等于 ${expected}`;
    const passed = actual === expected;
    
    this.recordAssertion({
      description,
      passed,
      actual,
      expected,
      error: passed ? undefined : `${actual} !== ${expected}`
    });
  }

  /**
   * 断言深度相等
   */
  deepEqual(actual: any, expected: any, message?: string): void {
    const description = message || `期望深度相等`;
    const passed = JSON.stringify(actual) === JSON.stringify(expected);
    
    this.recordAssertion({
      description,
      passed,
      actual,
      expected,
      error: passed ? undefined : '对象不相等'
    });
  }

  /**
   * 断言为真
   */
  isTrue(value: any, message?: string): void {
    const description = message || `期望为真`;
    const passed = value === true;
    
    this.recordAssertion({
      description,
      passed,
      actual: value,
      expected: true,
      error: passed ? undefined : `${value} 不是 true`
    });
  }

  /**
   * 断言为假
   */
  isFalse(value: any, message?: string): void {
    const description = message || `期望为假`;
    const passed = value === false;
    
    this.recordAssertion({
      description,
      passed,
      actual: value,
      expected: false,
      error: passed ? undefined : `${value} 不是 false`
    });
  }

  /**
   * 断言为null
   */
  isNull(value: any, message?: string): void {
    const description = message || `期望为 null`;
    const passed = value === null;
    
    this.recordAssertion({
      description,
      passed,
      actual: value,
      expected: null,
      error: passed ? undefined : `${value} 不是 null`
    });
  }

  /**
   * 断言不为null
   */
  isNotNull(value: any, message?: string): void {
    const description = message || `期望不为 null`;
    const passed = value !== null;
    
    this.recordAssertion({
      description,
      passed,
      actual: value,
      error: passed ? undefined : `值为 null`
    });
  }

  /**
   * 断言存在（非undefined）
   */
  isDefined(value: any, message?: string): void {
    const description = message || `期望已定义`;
    const passed = value !== undefined;
    
    this.recordAssertion({
      description,
      passed,
      actual: value,
      error: passed ? undefined : `值未定义`
    });
  }

  /**
   * 断言包含
   */
  contains(haystack: string | any[], needle: any, message?: string): void {
    const description = message || `期望包含 ${needle}`;
    const passed = Array.isArray(haystack) 
      ? haystack.includes(needle)
      : haystack.includes(needle);
    
    this.recordAssertion({
      description,
      passed,
      actual: haystack,
      expected: needle,
      error: passed ? undefined : `不包含 ${needle}`
    });
  }

  /**
   * 断言抛出异常
   */
  async throws(fn: () => any, expectedError?: string | RegExp, message?: string): Promise<void> {
    const description = message || `期望抛出异常`;
    let threw = false;
    let actualError: Error | null = null;
    
    try {
      await Promise.resolve(fn());
    } catch (error) {
      threw = true;
      actualError = error as Error;
    }
    
    let passed = threw;
    let errorMessage: string | undefined;
    
    if (threw && expectedError) {
      if (typeof expectedError === 'string') {
        passed = actualError!.message.includes(expectedError);
        errorMessage = passed ? undefined : `错误消息不匹配: "${actualError!.message}"`;
      } else if (expectedError instanceof RegExp) {
        passed = expectedError.test(actualError!.message);
        errorMessage = passed ? undefined : `错误消息不匹配正则: "${actualError!.message}"`;
      }
    } else if (!threw) {
      errorMessage = '函数未抛出异常';
    }
    
    this.recordAssertion({
      description,
      passed,
      actual: actualError?.message,
      expected: expectedError?.toString(),
      error: errorMessage
    });
  }

  /**
   * 断言大于
   */
  isGreaterThan(actual: number, expected: number, message?: string): void {
    const description = message || `期望 ${actual} > ${expected}`;
    const passed = actual > expected;
    
    this.recordAssertion({
      description,
      passed,
      actual,
      expected,
      error: passed ? undefined : `${actual} 不大于 ${expected}`
    });
  }

  /**
   * 断言小于
   */
  isLessThan(actual: number, expected: number, message?: string): void {
    const description = message || `期望 ${actual} < ${expected}`;
    const passed = actual < expected;
    
    this.recordAssertion({
      description,
      passed,
      actual,
      expected,
      error: passed ? undefined : `${actual} 不小于 ${expected}`
    });
  }

  /**
   * 记录断言结果
   */
  private recordAssertion(assertion: AssertionResult): void {
    const currentTest = (this.runner as any).currentTest;
    if (currentTest) {
      currentTest.assertions.push(assertion);
    }
  }
}

// 创建全局测试实例
export const runner = new TestRunner();
export const assert = new Assert(runner);
export const { describe, it, beforeEach, afterEach } = {
  describe: runner.describe.bind(runner),
  it: runner.it.bind(runner),
  beforeEach: runner.beforeEach.bind(runner),
  afterEach: runner.afterEach.bind(runner)
};