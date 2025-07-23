import dotenv from 'dotenv';
import { ServiceConfig } from '../interfaces/api-types';

// 加载环境变量
dotenv.config();

/**
 * 应用配置类
 */
export class Config {
  
  /**
   * 获取MiniMax配置
   */
  static getMiniMaxConfig(): ServiceConfig {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      throw new Error('MINIMAX_API_KEY 环境变量未设置');
    }

    return {
      apiKey,
      baseUrl: process.env.MINIMAX_API_BASE_URL || 'https://api.minimax.chat',
      timeout: parseInt(process.env.API_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelayBase: parseInt(process.env.RETRY_DELAY_BASE || '1000'),
      groupId: process.env.MINIMAX_GROUP_ID,
    };
  }

  /**
   * 获取通义千问配置
   */
  static getTongyiConfig(): ServiceConfig {
    const apiKey = process.env.TONGYI_API_KEY;
    if (!apiKey) {
      throw new Error('TONGYI_API_KEY 环境变量未设置');
    }

    return {
      apiKey,
      baseUrl: process.env.TONGYI_API_BASE_URL || 'https://dashscope.aliyuncs.com',
      timeout: parseInt(process.env.API_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelayBase: parseInt(process.env.RETRY_DELAY_BASE || '1000'),
    };
  }

  /**
   * 获取讯飞星火配置
   */
  static getIflytekConfig(): ServiceConfig & { 
    appId: string; 
    apiSecret: string; 
  } {
    const apiKey = process.env.IFLYTEK_API_KEY;
    const appId = process.env.IFLYTEK_APP_ID;
    const apiSecret = process.env.IFLYTEK_API_SECRET;
    
    if (!apiKey || !appId || !apiSecret) {
      throw new Error('讯飞星火环境变量未完整设置 (IFLYTEK_API_KEY, IFLYTEK_APP_ID, IFLYTEK_API_SECRET)');
    }

    return {
      apiKey,
      baseUrl: process.env.IFLYTEK_API_BASE_URL || 'https://iat-api.xfyun.cn',
      timeout: parseInt(process.env.API_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelayBase: parseInt(process.env.RETRY_DELAY_BASE || '1000'),
      appId,
      apiSecret,
    };
  }

  /**
   * 获取IP诊断配置
   */
  static getIPDiagnosisConfig(): ServiceConfig {
    // 暂时使用MiniMax作为IP诊断服务
    return this.getMiniMaxConfig();
  }

  /**
   * 获取测试配置
   */
  static getTestConfig() {
    return {
      audio30sPath: process.env.TEST_AUDIO_30S_PATH || './test-data/audio-30s.mp3',
      audio45sPath: process.env.TEST_AUDIO_45S_PATH || './test-data/audio-45s.mp3',
      audio60sPath: process.env.TEST_AUDIO_60S_PATH || './test-data/audio-60s.mp3',
      scriptSample: process.env.TEST_SCRIPT_SAMPLE || '这是一个短视频脚本测试样本',
    };
  }

  /**
   * 获取应用配置
   */
  static getAppConfig() {
    return {
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
      apiTimeout: parseInt(process.env.API_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelayBase: parseInt(process.env.RETRY_DELAY_BASE || '1000'),
    };
  }

  /**
   * 验证所有必需的环境变量
   */
  static validateEnv(): { valid: boolean; missing: string[] } {
    const required = [
      'MINIMAX_API_KEY',
      'MINIMAX_GROUP_ID',
      'TONGYI_API_KEY', 
      'IFLYTEK_API_KEY',
      'IFLYTEK_APP_ID',
      'IFLYTEK_API_SECRET'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * 打印配置摘要（安全版本，不显示敏感信息）
   */
  static printConfigSummary(): void {
    const validation = this.validateEnv();
    
    console.log('\\n=== 配置摘要 ===');
    console.log(`环境: ${this.getAppConfig().nodeEnv}`);
    console.log(`日志级别: ${this.getAppConfig().logLevel}`);
    console.log(`API超时: ${this.getAppConfig().apiTimeout}ms`);
    console.log(`最大重试: ${this.getAppConfig().maxRetries}次`);
    
    console.log('\\n=== 服务配置 ===');
    console.log(`MiniMax: ${process.env.MINIMAX_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`通义千问: ${process.env.TONGYI_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`讯飞星火: ${process.env.IFLYTEK_API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
    
    if (!validation.valid) {
      console.log('\\n❌ 缺失环境变量:');
      validation.missing.forEach(key => console.log(`  - ${key}`));
    } else {
      console.log('\\n✅ 所有必需环境变量已配置');
    }
  }
}