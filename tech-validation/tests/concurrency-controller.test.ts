import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConcurrencyController } from '../utils/concurrency-controller';

describe('ConcurrencyController', () => {
  let controller: ConcurrencyController;

  beforeEach(() => {
    controller = new ConcurrencyController(2);
  });

  describe('基本功能', () => {
    it('应该正确初始化', () => {
      expect(controller.getActiveCount()).toBe(0);
      expect(controller.getQueueLength()).toBe(0);
    });

    it('应该拒绝无效的并发限制', () => {
      expect(() => new ConcurrencyController(0)).toThrow('maxConcurrent must be at least 1');
      expect(() => new ConcurrencyController(-1)).toThrow('maxConcurrent must be at least 1');
    });

    it('应该执行单个操作', async () => {
      const result = await controller.execute('session-1', async () => {
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(controller.getActiveCount()).toBe(0);
    });
  });

  describe('并发控制', () => {
    it('应该限制并发请求数', async () => {
      const operations: Promise<number>[] = [];
      const delays = [100, 100, 100, 100];
      
      // 启动4个操作，但并发限制为2
      for (let i = 0; i < 4; i++) {
        operations.push(
          controller.execute(`session-${i}`, async () => {
            await new Promise(resolve => setTimeout(resolve, delays[i]));
            return i;
          })
        );
      }
      
      // 立即检查状态
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(controller.getActiveCount()).toBe(2);
      expect(controller.getQueueLength()).toBe(2);
      
      // 等待所有操作完成
      const results = await Promise.all(operations);
      expect(results).toEqual([0, 1, 2, 3]);
      expect(controller.getActiveCount()).toBe(0);
      expect(controller.getQueueLength()).toBe(0);
    });

    it('应该按顺序处理队列', async () => {
      const order: number[] = [];
      const operations: Promise<void>[] = [];
      
      // 创建5个操作
      for (let i = 0; i < 5; i++) {
        operations.push(
          controller.execute(`session-${i}`, async () => {
            order.push(i);
            await new Promise(resolve => setTimeout(resolve, 50));
          })
        );
      }
      
      await Promise.all(operations);
      
      // 前两个应该立即执行，后续按顺序
      expect(order[0]).toBeLessThan(2);
      expect(order[1]).toBeLessThan(2);
      expect(order.slice(2)).toEqual([2, 3, 4]);
    });
  });

  describe('错误处理', () => {
    it('应该正确处理操作错误', async () => {
      const error = new Error('Operation failed');
      
      await expect(
        controller.execute('session-error', async () => {
          throw error;
        })
      ).rejects.toThrow('Operation failed');
      
      // 错误后应该继续处理队列
      expect(controller.getActiveCount()).toBe(0);
    });

    it('应该在错误后继续处理队列', async () => {
      const results: Array<number | Error> = [];
      const operations: Promise<any>[] = [];
      
      // 使用更多的操作来确保处理顺序
      for (let i = 0; i < 4; i++) {
        operations.push(
          controller.execute(`session-${i}`, async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            if (i === 1) throw new Error(`Error ${i}`);
            return i;
          }).then(
            result => {
              results.push(result);
            },
            error => {
              results.push(error);
            }
          )
        );
      }
      
      await Promise.all(operations);
      
      expect(results.length).toBe(4);
      // 前两个立即执行，所以结果顺序可能是0,1(error)或1(error),0
      expect(results.filter(r => r instanceof Error).length).toBe(1);
      expect(results.filter(r => typeof r === 'number').length).toBe(3);
      expect(results.find(r => r instanceof Error)?.message).toContain('Error 1');
    });
  });

  describe('状态查询', () => {
    it('应该正确报告会话状态', async () => {
      const operation = controller.execute('session-1', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'done';
      });
      
      // 操作开始后立即检查
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(controller.isActive('session-1')).toBe(true);
      expect(controller.isActive('session-2')).toBe(false);
      
      await operation;
      expect(controller.isActive('session-1')).toBe(false);
    });

    it('应该提供完整的状态报告', async () => {
      const operations: Promise<any>[] = [];
      
      // 创建3个操作（2个活跃，1个排队）
      for (let i = 0; i < 3; i++) {
        operations.push(
          controller.execute(`session-${i}`, async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
          })
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const status = controller.getStatus();
      expect(status).toEqual({
        maxConcurrent: 2,
        activeCount: 2,
        queueLength: 1,
        activeSessions: expect.arrayContaining(['session-0', 'session-1']),
        queuedSessions: ['session-2']
      });
      
      await Promise.all(operations);
    });
  });

  describe('队列取消', () => {
    it('应该能够取消排队的请求', async () => {
      const operations: Promise<any>[] = [];
      const cancelResults: Array<string | Error> = [];
      
      // 填满活跃槽位
      for (let i = 0; i < 2; i++) {
        operations.push(
          controller.execute(`active-${i}`, async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return `active-${i}`;
          })
        );
      }
      
      // 添加将被取消的请求
      operations.push(
        controller.execute('to-cancel', async () => {
          return 'should-not-run';
        }).catch(error => error)
      );
      
      // 等待请求进入队列
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 取消排队的请求
      const cancelled = controller.cancelQueued('to-cancel');
      expect(cancelled).toBe(true);
      expect(controller.getQueueLength()).toBe(0);
      
      // 验证被取消的请求收到错误
      const finalResults = await Promise.all(operations);
      expect(finalResults[2]).toBeInstanceOf(Error);
      expect((finalResults[2] as Error).message).toBe('Request cancelled');
    });

    it('不应该取消正在执行的请求', () => {
      controller.execute('active', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      const cancelled = controller.cancelQueued('active');
      expect(cancelled).toBe(false);
    });
  });

  describe('内存管理', () => {
    it('应该在操作完成后清理引用', async () => {
      const bigData = new Array(1000).fill('data');
      
      await controller.execute('session-1', async () => {
        // 模拟处理大数据
        return bigData.length;
      });
      
      // 验证会话已从活跃列表中移除
      expect(controller.getActiveCount()).toBe(0);
      expect(controller.isActive('session-1')).toBe(false);
      
      const status = controller.getStatus();
      expect(status.activeSessions).not.toContain('session-1');
    });
  });
});