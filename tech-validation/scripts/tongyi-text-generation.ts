#!/usr/bin/env ts-node

import {
  AIServiceClient,
  ServiceConfig,
  SpeechToTextRequest,
  SpeechToTextResponse,
  TextGenerationRequest,
  TextGenerationResponse
} from '../interfaces/api-types';
import { ApiClient } from '../utils/api-client';
import { logger } from '../utils/logger';
import { Config } from '../utils/config';

/**
 * 通义千问 API 客户端实现
 */
export class TongyiClient implements AIServiceClient {
  name = 'Tongyi-Qwen';
  private apiClient!: ApiClient;
  private config!: ServiceConfig; // 存储配置信息，用于调试和扩展

  /**
   * 初始化客户端
   */
  async initialize(config: ServiceConfig): Promise<void> {
    this.config = { ...config };
    
    // 创建定制的 API 客户端
    this.apiClient = new ApiClient({
      ...config,
      // 使用 OpenAI 兼容模式的端点
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    });

    logger.info(this.name, 'initialize', '客户端初始化完成', {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      timeout: this.config.timeout
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      logger.info(this.name, 'healthCheck', '开始健康检查');
      
      // 使用简单的文本生成作为健康检查
      const testRequest: TextGenerationRequest = {
        prompt: 'Hello',
        max_tokens: 10,
        temperature: 0.1
      };

      const result = await this.generateText(testRequest);
      const isHealthy: boolean = !!(result && result.text && result.text.length > 0);

      logger.info(this.name, 'healthCheck', `健康检查${isHealthy ? '通过' : '失败'}`, {
        responseLength: result?.text?.length || 0
      });
      
      return isHealthy;
    } catch (error) {
      logger.error(this.name, 'healthCheck', '健康检查失败', error as Error);
      return false;
    }
  }

  /**
   * 文本生成 (通义千问的主要功能)
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    logger.info(this.name, 'generateText', '开始文本生成', {
      promptLength: request.prompt.length,
      model: request.model || 'qwen-plus',
      maxTokens: request.max_tokens
    });

    const startTime = Date.now();

    try {
      // 构造 OpenAI 兼容格式的请求
      const requestData = {
        model: request.model || 'qwen-plus', // 推荐使用 qwen-plus (效果、速度、成本均衡)
        messages: [
          {
            role: 'user',
            content: request.prompt
          }
        ],
        max_tokens: request.max_tokens || 1000,
        temperature: request.temperature !== undefined ? request.temperature : 0.7,
        top_p: request.top_p !== undefined ? request.top_p : 0.8,
        stream: Boolean(request.stream)
      };

      const response = await this.apiClient.post('/chat/completions', requestData);
      const duration = Date.now() - startTime;

      const responseData: any = response;
      const result: TextGenerationResponse = {
        text: responseData.choices?.[0]?.message?.content || '生成失败',
        finish_reason: responseData.choices?.[0]?.finish_reason,
        model: responseData.model,
        created: responseData.created,
      };

      logger.info(this.name, 'generateText', '文本生成完成', {
        duration,
        inputLength: request.prompt.length,
        outputLength: result.text.length,
        model: result.model,
        finishReason: result.finish_reason
      });

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(this.name, 'generateText', '文本生成失败', error, { 
        duration,
        promptLength: request.prompt.length 
      });
      throw error;
    }
  }

  /**
   * 语音转文字 (通义千问不直接支持，但可以通过其他阿里云服务实现)
   */
  async speechToText(request: SpeechToTextRequest): Promise<SpeechToTextResponse> {
    logger.warn(this.name, 'speechToText', '通义千问主要用于文本生成，不直接支持语音转文字');
    
    // 返回一个说明性响应
    return {
      text: '[不支持] 通义千问专注于文本生成，语音转文字请使用阿里云语音服务或讯飞星火',
      confidence: 0,
      duration: 0,
      language: request.language || 'zh-CN',
    };
  }

  /**
   * 专业的短视频脚本仿写功能
   */
  async rewriteVideoScript(originalScript: string, style?: string, duration?: number): Promise<TextGenerationResponse> {
    logger.info(this.name, 'rewriteVideoScript', '开始短视频脚本仿写', {
      originalLength: originalScript.length,
      style: style || 'default',
      duration: duration || 60
    });

    const stylePrompts = {
      'funny': '幽默搞笑',
      'serious': '严肃正式', 
      'casual': '轻松随意',
      'educational': '教育科普',
      'inspirational': '励志正能量',
      'trendy': '时尚潮流'
    };

    const selectedStyle = stylePrompts[style as keyof typeof stylePrompts] || '自然流畅';
    const targetDuration = duration || 60;

    const prompt = `请基于以下原始短视频脚本，创作一个新的${targetDuration}秒短视频脚本。要求：

原始脚本：
${originalScript}

创作要求：
1. 风格：${selectedStyle}
2. 时长：约${targetDuration}秒（建议${Math.floor(targetDuration * 2.5) - 20}到${Math.floor(targetDuration * 2.5) + 20}个字）
3. 保持核心主题，但用不同的表达方式
4. 适合短视频平台（抖音、快手等）的表达习惯
5. 开头要抓人眼球，结尾要有互动引导
6. 语言生动有趣，节奏紧凑

请直接输出新脚本，不需要额外说明：`;

    const request: TextGenerationRequest = {
      prompt,
      model: 'qwen-plus', // 使用推荐的均衡模型
      max_tokens: Math.max(500, Math.floor(targetDuration * 8)), // 根据时长动态调整
      temperature: 0.8, // 稍高的创造性
      top_p: 0.9
    };

    try {
      const result = await this.generateText(request);
      
      logger.info(this.name, 'rewriteVideoScript', '脚本仿写完成', {
        originalLength: originalScript.length,
        newLength: result.text.length,
        style: selectedStyle,
        targetDuration
      });

      return result;
    } catch (error) {
      logger.error(this.name, 'rewriteVideoScript', '脚本仿写失败', error as Error);
      throw error;
    }
  }

  /**
   * 批量脚本仿写（支持多种风格）
   */
  async batchRewriteScripts(
    originalScript: string, 
    styles: string[] = ['funny', 'educational', 'inspirational'],
    duration: number = 60
  ): Promise<{ style: string; script: TextGenerationResponse }[]> {
    logger.info(this.name, 'batchRewriteScripts', '开始批量脚本仿写', {
      originalLength: originalScript.length,
      styles: styles.length,
      targetDuration: duration
    });

    const results: { style: string; script: TextGenerationResponse }[] = [];

    for (const style of styles) {
      try {
        logger.debug(this.name, 'batchRewriteScripts', `处理风格: ${style}`);
        const result = await this.rewriteVideoScript(originalScript, style, duration);
        results.push({ style, script: result });
        
        // 避免API限流，短暂延迟
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(this.name, 'batchRewriteScripts', `风格 ${style} 仿写失败`, error as Error);
        // 继续处理其他风格
        continue;
      }
    }

    logger.info(this.name, 'batchRewriteScripts', '批量脚本仿写完成', {
      successCount: results.length,
      totalCount: styles.length
    });

    return results;
  }
}

/**
 * 测试函数
 */
async function testTongyi() {
  console.log('\\n=== 通义千问 API 集成验证测试 ===\\n');

  try {
    // 验证环境变量
    Config.printConfigSummary();

    const validation = Config.validateEnv();
    if (!validation.valid) {
      console.error('\\n❌ 环境变量验证失败，请检查配置');
      return;
    }

    // 初始化客户端
    const client = new TongyiClient();
    const config = Config.getTongyiConfig();
    await client.initialize(config);

    // 健康检查
    console.log('\\n1. 执行健康检查...');
    const isHealthy = await client.healthCheck();
    console.log(`健康检查结果: ${isHealthy ? '✅ 通过' : '❌ 失败'}`);

    if (!isHealthy) {
      console.log('⚠️  健康检查失败，但继续进行功能测试');
    }

    // 测试基础文本生成
    console.log('\\n2. 测试基础文本生成功能...');
    try {
      const textRequest: TextGenerationRequest = {
        prompt: '请介绍一下人工智能在短视频制作中的应用，控制在100字以内',
        max_tokens: 200,
        temperature: 0.7,
      };

      const textResult = await client.generateText(textRequest);
      console.log('✅ 基础文本生成成功');
      console.log('生成内容:', textResult.text);
      console.log('内容长度:', textResult.text.length + '字');
      console.log('模型:', textResult.model);
    } catch (error: any) {
      console.log('❌ 基础文本生成失败:', error.message);
    }

    // 测试短视频脚本仿写
    console.log('\\n3. 测试短视频脚本仿写功能...');
    try {
      const originalScript = `
大家好！今天要和大家分享一个超实用的手机拍摄技巧。
你是不是经常拍出来的照片不够清晰？问题可能出在这里：
第一，光线不足时记得打开夜间模式；
第二，拍摄时双手要稳，可以靠墙或用三脚架；
第三，焦点要对准主体，点击屏幕对焦。
掌握这三点，你的照片质量立马提升！
关注我，每天分享更多实用技巧！
      `.trim();

      const rewriteResult = await client.rewriteVideoScript(originalScript, 'funny', 60);
      console.log('✅ 脚本仿写成功');
      console.log('原始脚本长度:', originalScript.length + '字');
      console.log('仿写脚本长度:', rewriteResult.text.length + '字');
      console.log('\\n仿写结果:');
      console.log(rewriteResult.text);
    } catch (error: any) {
      console.log('❌ 脚本仿写失败:', error.message);
    }

    // 测试批量风格仿写
    console.log('\\n4. 测试批量风格仿写功能...');
    try {
      const testScript = '学会这个Excel技巧，工作效率提升10倍！打开数据透视表，拖拽字段到对应区域，一键生成报表。老板看了都说好！';
      
      const batchResults = await client.batchRewriteScripts(
        testScript, 
        ['educational', 'funny'], // 减少数量以节省时间
        45
      );

      console.log(`✅ 批量仿写成功，生成了 ${batchResults.length} 个版本:`);
      batchResults.forEach((result, index) => {
        console.log(`\\n${index + 1}. 风格: ${result.style}`);
        console.log(`   长度: ${result.script.text.length}字`);
        console.log(`   内容: ${result.script.text.substring(0, 50)}...`);
      });
    } catch (error: any) {
      console.log('❌ 批量仿写失败:', error.message);
    }

    // 输出性能指标
    console.log('\\n=== 性能指标 ===');
    const metrics = client['apiClient']?.getMetrics() || [];
    metrics.forEach(metric => {
      logger.logMetrics(metric);
    });

    // 输出日志摘要
    logger.printSummary();

  } catch (error: any) {
    console.error('\\n❌ 测试过程中发生错误:', error.message);
    logger.error('Tongyi', 'test', '测试失败', error);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testTongyi().catch(console.error);
}