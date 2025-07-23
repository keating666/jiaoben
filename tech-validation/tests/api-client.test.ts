#!/usr/bin/env ts-node

import { describe, it, beforeEach, afterEach, assert, runner } from './test-framework';
import { EnhancedApiClient } from '../utils/enhanced-api-client';
import { ApiClient } from '../utils/api-client';
import { CircuitBreaker } from '../utils/circuit-breaker';
import axios from 'axios';

// Mock axios 用于测试
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API客户端测试套件', () => {
  let client: ApiClient;
  let enhancedClient: EnhancedApiClient;

  beforeEach(() => {
    // 重置所有 mock
    jest.clearAllMocks();
    
    // 创建测试客户端
    client = new ApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      timeout: 5000,
      maxRetries: 3,
      retryDelayBase: 100
    });

    enhancedClient = new EnhancedApiClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.test.com',
      timeout: 5000,
      maxRetries: 3,
      retryDelayBase: 100,
      circuitBreakerConfig: {
        failureThreshold: 3,
        resetTimeout: 1000,
        monitoringPeriod: 500
      },
      rateLimitConfig: {
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000
      }
    });
  });

  describe('基础功能测试', () => {
    it('应该正确初始化客户端', async () => {
      assert.isDefined(client, '客户端应该被创建');
      assert.isDefined(enhancedClient, '增强客户端应该被创建');
    });

    it('应该正确处理成功的GET请求', async () => {
      const mockData = { message: 'success' };
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockData }),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      const result = await client.get('/test');
      assert.deepEqual(result, mockData, '应该返回正确的数据');
    });

    it('应该正确处理成功的POST请求', async () => {
      const requestData = { name: 'test' };
      const responseData = { id: 1, name: 'test' };
      
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: responseData }),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      const result = await client.post('/test', requestData);
      assert.deepEqual(result, responseData, '应该返回正确的响应数据');
    });
  });

  describe('重试机制测试', () => {
    it('应该在网络错误时重试', async () => {
      let attempts = 0;
      const mockError = new Error('Network Error');
      (mockError as any).code = 'ECONNREFUSED';
      
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 3) {
            return Promise.reject(mockError);
          }
          return Promise.resolve({ data: { success: true } });
        }),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      const result = await client.get('/test');
      assert.equal(attempts, 3, '应该重试3次');
      assert.deepEqual(result, { success: true }, '最终应该成功');
    });

    it('应该在达到最大重试次数后失败', async () => {
      const mockError = new Error('Network Error');
      (mockError as any).code = 'ECONNREFUSED';
      
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      await assert.throws(
        () => client.get('/test'),
        'Network Error',
        '应该在最大重试后抛出错误'
      );
    });

    it('不应该重试4xx客户端错误', async () => {
      let attempts = 0;
      const mockError = new Error('Bad Request');
      (mockError as any).response = { status: 400 };
      
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockImplementation(() => {
          attempts++;
          return Promise.reject(mockError);
        }),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      await assert.throws(
        () => client.get('/test'),
        'Bad Request',
        '应该立即失败，不重试'
      );
      
      assert.equal(attempts, 1, '不应该重试客户端错误');
    });

    it('应该使用指数退避策略', async () => {
      const delays: number[] = [];
      let lastTime = Date.now();
      
      const mockError = new Error('Server Error');
      (mockError as any).response = { status: 500 };
      
      // Mock setTimeout to capture delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((fn: Function, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0); // Execute immediately for testing
      }) as any;

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      try {
        await client.get('/test');
      } catch (e) {
        // Expected to fail
      }

      global.setTimeout = originalSetTimeout;

      assert.equal(delays.length, 3, '应该有3次延迟');
      assert.isTrue(delays[0] >= 100, '第一次延迟应该至少100ms');
      assert.isTrue(delays[1] >= 200, '第二次延迟应该至少200ms');
      assert.isTrue(delays[2] >= 400, '第三次延迟应该至少400ms');
    });
  });

  describe('断路器测试', () => {
    it('断路器应该在连续失败后打开', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        monitoringPeriod: 500
      });

      let callCount = 0;
      const failingOperation = async () => {
        callCount++;
        throw new Error('Service unavailable');
      };

      // 前3次失败应该正常执行
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingOperation, 'test-op');
        } catch (e) {
          // Expected
        }
      }

      assert.equal(callCount, 3, '应该执行3次');
      assert.equal(breaker.getState(), 'OPEN', '断路器应该打开');

      // 第4次应该直接失败，不执行操作
      await assert.throws(
        () => breaker.execute(failingOperation, 'test-op'),
        '断路器开启',
        '断路器打开时应该快速失败'
      );
      
      assert.equal(callCount, 3, '不应该执行第4次');
    });

    it('断路器应该在超时后进入半开状态', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100, // 短超时用于测试
        monitoringPeriod: 50
      });

      const failingOperation = async () => {
        throw new Error('Service unavailable');
      };

      // 触发断路器打开
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingOperation, 'test-op');
        } catch (e) {
          // Expected
        }
      }

      assert.equal(breaker.getState(), 'OPEN', '断路器应该打开');

      // 等待重置超时
      await new Promise(resolve => setTimeout(resolve, 150));

      // 下一次调用应该尝试执行（半开状态）
      let executed = false;
      const testOperation = async () => {
        executed = true;
        return 'success';
      };

      const result = await breaker.execute(testOperation, 'test-op');
      assert.isTrue(executed, '应该执行操作（半开状态）');
      assert.equal(result, 'success', '应该返回成功结果');
      assert.equal(breaker.getState(), 'CLOSED', '成功后断路器应该关闭');
    });
  });

  describe('限流测试', () => {
    it('应该正确限制每分钟请求数', async () => {
      const rateLimitedClient = new EnhancedApiClient({
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        timeout: 5000,
        rateLimitConfig: {
          maxRequestsPerMinute: 3,
          maxRequestsPerHour: 100
        }
      });

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: { success: true } }),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      // 前3个请求应该成功
      for (let i = 0; i < 3; i++) {
        await rateLimitedClient.get('/test');
      }

      // 第4个请求应该被限流
      await assert.throws(
        () => rateLimitedClient.get('/test'),
        '限流：每分钟请求超限',
        '超过限制应该抛出限流错误'
      );
    });
  });

  describe('错误处理测试', () => {
    it('应该正确转换API错误', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            message: 'Invalid request',
            code: 'INVALID_REQUEST'
          }
        },
        message: 'Request failed'
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      try {
        await client.get('/test');
        assert.isTrue(false, '应该抛出错误');
      } catch (error: any) {
        assert.equal(error.message, 'Invalid request', '应该使用API错误消息');
        assert.equal(error.status, 400, '应该包含状态码');
        assert.equal(error.code, 'INVALID_REQUEST', '应该包含错误代码');
        assert.isFalse(error.retryable, '4xx错误不应该可重试');
      }
    });

    it('应该正确处理超时错误', async () => {
      const mockError = new Error('timeout of 5000ms exceeded');
      (mockError as any).code = 'ECONNABORTED';

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(mockError),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      try {
        await client.get('/test');
        assert.isTrue(false, '应该抛出错误');
      } catch (error: any) {
        assert.equal(error.code, 'ECONNABORTED', '应该保留错误代码');
        assert.isTrue(error.retryable, '超时错误应该可重试');
      }
    });
  });

  describe('性能监控测试', () => {
    it('应该正确记录请求指标', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ 
          data: { success: true },
          config: {
            method: 'get',
            url: '/test',
            metadata: { startTime: Date.now() - 100 }
          },
          status: 200
        }),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      await client.get('/test');
      
      const metrics = client.getMetrics();
      assert.isGreaterThan(metrics.length, 0, '应该记录指标');
      
      const lastMetric = metrics[metrics.length - 1];
      assert.equal(lastMetric.success, true, '应该标记为成功');
      assert.isDefined(lastMetric.duration, '应该记录持续时间');
      assert.equal(lastMetric.operation, 'GET /test', '应该记录操作名称');
    });

    it('应该限制指标数量', async () => {
      // 模拟大量请求
      for (let i = 0; i < 1500; i++) {
        client['metrics'].push({
          requestId: `req_${i}`,
          service: 'test',
          operation: 'test',
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 10,
          success: true
        });
      }

      assert.isLessThan(
        client.getMetrics().length, 
        1100, 
        '应该限制指标数量在1000条左右'
      );
    });
  });

  describe('健康检查测试', () => {
    it('应该正确处理健康检查成功', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: { status: 'ok' } }),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      const result = await client.healthCheck();
      assert.isTrue(result, '健康检查应该返回true');
    });

    it('应该正确处理健康检查失败', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Service unavailable')),
        defaults: { headers: {} },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      } as any);

      const result = await client.healthCheck();
      assert.isFalse(result, '健康检查失败应该返回false');
    });
  });
});

// 运行测试
if (require.main === module) {
  runner.run().catch(console.error);
}