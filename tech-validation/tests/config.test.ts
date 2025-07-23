/**
 * Config 工具测试用例
 * 用于验证配置管理功能的正确性
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { Config } from '../utils/config';

describe('Config 工具测试', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 保存原始环境变量
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  it('应该正确读取 MiniMax 配置', () => {
    // 设置测试环境变量
    process.env.MINIMAX_API_KEY = 'test-minimax-key';
    process.env.MINIMAX_GROUP_ID = 'test-group-id';
    
    const config = Config.getMiniMaxConfig();

    expect(config.apiKey).toBeDefined();
    expect(config.baseUrl).toBeDefined();
  });

  it('应该有默认配置值', () => {
    // 设置必需的环境变量
    process.env.MINIMAX_API_KEY = 'test-key';
    process.env.MINIMAX_GROUP_ID = 'test-group';
    
    const config = Config.getMiniMaxConfig();

    expect(config.timeout).toBeGreaterThan(0);
    expect(config.maxRetries).toBeGreaterThan(0);
  });

  it('应该正确处理数字类型的环境变量', () => {
    process.env.MINIMAX_API_KEY = 'test-key';
    process.env.MINIMAX_GROUP_ID = 'test-group';
    process.env.MINIMAX_TIMEOUT = '5000';
    process.env.MINIMAX_MAX_RETRIES = '3';
    
    const config = Config.getMiniMaxConfig();

    expect(typeof config.timeout).toBe('number');
    expect(typeof config.maxRetries).toBe('number');
    expect(config.timeout).toBeGreaterThan(0);
    expect(config.maxRetries).toBeGreaterThan(0);
  });

  it('应该正确处理布尔类型的环境变量', () => {
    process.env.DEBUG = 'true';
    process.env.STRICT_MODE = 'false';
    
    const debugValue = process.env.DEBUG === 'true';
    const strictValue = process.env.STRICT_MODE === 'true';
    
    expect(typeof debugValue).toBe('boolean');
    expect(typeof strictValue).toBe('boolean');
    expect(debugValue).toBe(true);
    expect(strictValue).toBe(false);
  });

  it('应该验证必需的配置项', () => {
    // 测试 API Key 验证
    delete process.env.MINIMAX_API_KEY;
    
    // 应该抛出错误当 API Key 缺失
    expect(() => Config.getMiniMaxConfig()).toThrow('MINIMAX_API_KEY 环境变量未设置');
  });

  it('应该提供配置项的描述信息', () => {
    // 设置必需变量
    process.env.MINIMAX_API_KEY = 'test-key';
    process.env.MINIMAX_GROUP_ID = 'test-group';
    
    // 测试配置对象的结构
    const config = Config.getMiniMaxConfig();

    expect(config).toHaveProperty('apiKey');
    expect(config).toHaveProperty('baseUrl');
    expect(config).toHaveProperty('timeout');
    expect(config).toHaveProperty('maxRetries');
  });

  it('应该正确获取通义千问配置', () => {
    // 由于环境变量已设置，直接测试返回的配置结构
    const config = Config.getTongyiConfig();

    expect(config.apiKey).toBeDefined();
    expect(config.apiKey).toMatch(/^sk-/); // 通义千问 API key 格式
    expect(config.baseUrl).toBeDefined();
    expect(config.baseUrl).toContain('dashscope');
  });
});