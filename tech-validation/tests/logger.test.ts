/**
 * Logger 工具测试用例
 * 用于验证日志记录功能的正确性
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Logger, LogLevel, logger } from '../utils/logger';

describe('Logger 工具测试', () => {
  let testLogger: Logger;
  let consoleSpy: jest.SpiedFunction<any>;

  beforeEach(() => {
    // 创建测试用的 logger 实例，设置 DEBUG 级别以便测试所有日志
    testLogger = new Logger(LogLevel.DEBUG);
    // 监听 console 方法
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // 恢复 console 方法
    consoleSpy.mockRestore();
  });

  it('应该正确记录 info 级别日志', async () => {
    const message = 'This is an info message';
    testLogger.info('test-service', 'test-operation', message);
    
    // 等待异步日志处理完成
    await new Promise(resolve => setImmediate(resolve));
    
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toContain('[INFO]');
    expect(consoleSpy.mock.calls[0][0]).toContain(message);
  });

  it('应该正确记录 error 级别日志', async () => {
    const errorMessage = 'This is an error message';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    testLogger.error('test-service', 'test-operation', errorMessage);
    
    // 等待异步日志处理完成
    await new Promise(resolve => setImmediate(resolve));
    
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toContain('[ERROR]');
    expect(errorSpy.mock.calls[0][0]).toContain(errorMessage);
    
    errorSpy.mockRestore();
  });

  it('应该正确记录 warn 级别日志', async () => {
    const warnMessage = 'This is a warning message';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    
    testLogger.warn('test-service', 'test-operation', warnMessage);
    
    // 等待异步日志处理完成
    await new Promise(resolve => setImmediate(resolve));
    
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('[WARN]');
    expect(warnSpy.mock.calls[0][0]).toContain(warnMessage);
    
    warnSpy.mockRestore();
  });

  it('应该正确记录 debug 级别日志', async () => {
    const debugMessage = 'This is a debug message';
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    
    testLogger.debug('test-service', 'test-operation', debugMessage);
    
    // 等待异步日志处理完成
    await new Promise(resolve => setImmediate(resolve));
    
    expect(debugSpy).toHaveBeenCalled();
    expect(debugSpy.mock.calls[0][0]).toContain('[DEBUG]');
    expect(debugSpy.mock.calls[0][0]).toContain(debugMessage);
    
    debugSpy.mockRestore();
  });

  it('应该包含时间戳', async () => {
    const message = 'Test message with timestamp';
    testLogger.info('test-service', 'test-operation', message);
    
    // 等待异步日志处理完成
    await new Promise(resolve => setImmediate(resolve));
    
    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    
    // 检查是否包含时间戳格式 (使用 toLocaleString 的格式)
    const timestampRegex = /\[.*\d{1,2}\/\d{1,2}\/\d{4}.*\]/; // [7/23/2025, 4:40:11 AM]
    expect(logOutput).toMatch(timestampRegex);
  });

  it('应该支持数据参数', async () => {
    const message = 'User operation with data';
    const data = { username: 'testuser', points: 100 };
    
    testLogger.info('test-service', 'test-operation', message, data);
    
    // 等待异步日志处理完成
    await new Promise(resolve => setImmediate(resolve));
    
    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('[INFO]');
    expect(logOutput).toContain(message);
    expect(logOutput).toContain('test-service:test-operation');
  });
});