#!/usr/bin/env ts-node

/**
 * 讯飞语音识别客户端测试脚本
 * 测试签名认证和基本功能
 */

import { IflytekClient } from '../clients/iflytek-client';
import { logger } from '../utils/logger';
import { Config } from '../utils/config';
import * as fs from 'fs';
import * as path from 'path';

async function testIflytekClient() {
  logger.info('IflytekTest', 'main', '开始测试讯飞语音识别客户端');
  
  try {
    // 1. 初始化客户端
    logger.info('IflytekTest', 'main', '步骤1: 初始化客户端');
    const client = new IflytekClient();
    
    await client.initialize({
      apiKey: process.env.IFLYTEK_API_KEY || '',
      baseUrl: 'wss://ws-api.xfyun.cn',
      timeout: 60000,
    });
    
    // 2. 健康检查
    logger.info('IflytekTest', 'main', '步骤2: 执行健康检查');
    const isHealthy = await client.healthCheck();
    logger.info('IflytekTest', 'main', `健康检查结果: ${isHealthy ? '通过' : '失败'}`);
    
    if (!isHealthy) {
      logger.error('IflytekTest', 'main', '健康检查失败，请检查配置和网络连接');
      return;
    }
    
    // 3. 测试语音识别（如果有测试音频文件）
    const testAudioPath = path.join(__dirname, '../../test-data/audio-30s.mp3');
    
    if (fs.existsSync(testAudioPath)) {
      logger.info('IflytekTest', 'main', '步骤3: 测试语音识别');
      
      const audioBuffer = fs.readFileSync(testAudioPath);
      const result = await client.speechToText({
        audioFile: audioBuffer,
        language: 'zh-CN',
        format: 'mp3',
      });
      
      logger.info('IflytekTest', 'main', '语音识别结果', {
        textLength: result.text.length,
        text: result.text.substring(0, 100) + (result.text.length > 100 ? '...' : ''),
        language: result.language,
      });
    } else {
      logger.warn('IflytekTest', 'main', '未找到测试音频文件，跳过语音识别测试');
    }
    
    // 4. 测试签名生成（独立测试）
    logger.info('IflytekTest', 'main', '步骤4: 测试签名生成');
    const { generateIflytekAuthHeaders } = await import('../clients/iflytek-client');
    
    const authHeaders = await generateIflytekAuthHeaders(
      process.env.IFLYTEK_APP_ID || '',
      process.env.IFLYTEK_API_KEY || '',
      process.env.IFLYTEK_API_SECRET || ''
    );
    
    logger.info('IflytekTest', 'main', '签名生成成功', {
      hasAuthorization: !!authHeaders.authorization,
      date: authHeaders.date,
      host: authHeaders.host,
    });
    
    // 5. 清理资源
    logger.info('IflytekTest', 'main', '步骤5: 清理资源');
    client.dispose();
    
    logger.info('IflytekTest', 'main', '✅ 讯飞语音识别客户端测试完成');
    
  } catch (error) {
    logger.error('IflytekTest', 'main', '测试过程中发生错误', error as Error);
  }
}

// 运行测试
if (require.main === module) {
  testIflytekClient().catch(console.error);
}