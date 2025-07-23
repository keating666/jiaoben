/**
 * Circuit Breaker 测试用例
 * 用于验证断路器模式的正确性
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CircuitBreaker } from '../utils/circuit-breaker';

describe('Circuit Breaker 测试', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringPeriod: 500
    });
  });

  it('应该正确初始化为关闭状态', () => {
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('应该在成功执行时保持关闭状态', async () => {
    const successfulOperation = async () => 'success';
    
    const result = await breaker.execute(successfulOperation, 'test-op');
    
    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('应该在连续失败后打开断路器', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    // 执行失败操作直到断路器打开
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation, 'test-op');
      } catch (error) {
        // 预期的失败
      }
    }

    expect(breaker.getState()).toBe('OPEN');
  });

  it('应该在断路器打开时快速失败', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    // 先触发断路器打开
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation, 'test-op');
      } catch (error) {
        // 预期的失败
      }
    }

    // 现在断路器应该打开，下一次调用应该快速失败
    await expect(breaker.execute(failingOperation, 'test-op'))
      .rejects.toThrow('断路器开启');
  });

  it('应该在超时后进入半开状态', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    // 触发断路器打开
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation, 'test-op');
      } catch (error) {
        // 预期的失败
      }
    }

    expect(breaker.getState()).toBe('OPEN');

    // 等待重置超时
    await new Promise(resolve => setTimeout(resolve, 1100));

    // 下一次调用应该尝试执行（半开状态）
    const testOperation = async () => 'success';
    const result = await breaker.execute(testOperation, 'test-op');

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('应该正确记录失败次数', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };

    let failureCount = 0;
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(failingOperation, 'test-op');
      } catch (error) {
        failureCount++;
      }
    }

    expect(failureCount).toBe(2);
    expect(breaker.getState()).toBe('CLOSED'); // 还没到阈值

    // 再失败一次应该打开断路器
    try {
      await breaker.execute(failingOperation, 'test-op');
    } catch (error) {
      failureCount++;
    }

    expect(failureCount).toBe(3);
    expect(breaker.getState()).toBe('OPEN');
  });

  it('应该在成功后重置失败计数', async () => {
    const failingOperation = async () => {
      throw new Error('Operation failed');
    };
    const successfulOperation = async () => 'success';

    // 先失败两次
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(failingOperation, 'test-op');
      } catch (error) {
        // 预期的失败
      }
    }

    expect(breaker.getState()).toBe('CLOSED');

    // 然后成功一次
    await breaker.execute(successfulOperation, 'test-op');

    // 失败计数应该重置，断路器仍然关闭
    expect(breaker.getState()).toBe('CLOSED');

    // 现在需要再次达到阈值才能打开断路器
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingOperation, 'test-op');
      } catch (error) {
        // 预期的失败
      }
    }

    expect(breaker.getState()).toBe('OPEN');
  });

  it('应该正确处理异步操作的超时', async () => {
    const slowOperation = async () => {
      return new Promise(resolve => setTimeout(() => resolve('slow'), 2000));
    };

    // 这个测试验证断路器不会干扰正常的异步操作
    const startTime = Date.now();
    const result = await breaker.execute(slowOperation, 'slow-op');
    const duration = Date.now() - startTime;

    expect(result).toBe('slow');
    expect(duration).toBeGreaterThan(1900); // 给一些误差空间
  });
});