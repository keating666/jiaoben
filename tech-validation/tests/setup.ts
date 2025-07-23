/**
 * Jest 测试环境配置
 * 用于设置全局测试环境和常用配置
 */

import { config } from 'dotenv';

// 加载测试环境变量
config({ path: '.env.test' });

// 设置测试超时
jest.setTimeout(10000);

// 保存原始控制台方法
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// 全局测试前设置
beforeAll(() => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  
  // 配置控制台输出级别（减少测试时的噪音）
  console.warn = jest.fn();
  console.error = jest.fn();
});

// 全局测试后恢复
afterAll(() => {
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// 全局测试后清理
afterEach(() => {
  // 清除所有 mock
  jest.clearAllMocks();
  
  // 清理环境变量（如果测试中修改了）
  delete process.env.TEST_API_KEY;
  delete process.env.TEST_API_URL;
});

// 声明全局类型以支持 TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(a: number, b: number): R;
    }
  }
}

// 扩展 Jest matchers（可选）
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});