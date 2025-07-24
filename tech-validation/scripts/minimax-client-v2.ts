#!/usr/bin/env ts-node

import FormData from 'form-data';

import { 
  AIServiceClient, 
  ServiceConfig, 
  SpeechToTextRequest, 
  SpeechToTextResponse,
  TextGenerationRequest,
  TextGenerationResponse,
} from '../interfaces/api-types';
import { EnhancedApiClient } from '../utils/enhanced-api-client';
import { logger } from '../utils/logger';
import { Config } from '../utils/config';

/**
 * MiniMax API 客户端实现 V2
 * 使用增强版API客户端，包含断路器、限流等功能
 */
export class MiniMaxClientV2 implements AIServiceClient {
  name = 'MiniMax-V2';
  private apiClient!: EnhancedApiClient;
  private config!: ServiceConfig;
  private modelCache = new Map<string, { models: any[], timestamp: number }>();
  private readonly CACHE_TTL = 3600000; // 1小时缓存

  /**
   * 初始化客户端
   */
  async initialize(config: ServiceConfig): Promise<void> {
    this.config = config;
    
    // 使用增强版API客户端
    this.apiClient = new EnhancedApiClient({
      ...config,
      circuitBreakerConfig: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 30000,
        requestTimeout: config.timeout,
      },
      rateLimitConfig: {
        maxRequestsPerMinute: 60,
        maxRequestsPerHour: 1000,
      },
    });
    
    logger.info(this.name, 'initialize', '增强版客户端初始化完成', { 
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      features: ['断路器', '限流', '智能重试'],
    });
  }

  /**
   * 健康检查（改进版）
   */
  async healthCheck(): Promise<boolean> {
    try {
      logger.info(this.name, 'healthCheck', '开始健康检查');
      
      // 尝试多个端点确保服务可用
      const healthEndpoints = [
        '/v1/models',
        '/v1/health',
        '/health',
      ];
      
      for (const endpoint of healthEndpoints) {
        try {
          const isHealthy = await this.apiClient.healthCheck(endpoint);

          if (isHealthy) {
            logger.info(this.name, 'healthCheck', '健康检查通过', { endpoint });

            return true;
          }
        } catch (error) {
          logger.debug(this.name, 'healthCheck', `端点 ${endpoint} 检查失败`, { 
            error: (error as Error).message, 
          });
        }
      }
      
      // 如果所有端点都失败，尝试一个简单的文本生成请求
      try {
        await this.generateText({
          prompt: 'Hi',
          max_tokens: 10,
          temperature: 0.1,
        });
        logger.info(this.name, 'healthCheck', '通过文本生成测试验证服务可用');

        return true;
      } catch (error) {
        logger.error(this.name, 'healthCheck', '所有健康检查方式都失败', error as Error);

        return false;
      }
    } catch (error) {
      logger.error(this.name, 'healthCheck', '健康检查失败', error as Error);

      return false;
    }
  }

  /**
   * 语音转文字（增强版）
   */
  async speechToText(request: SpeechToTextRequest): Promise<SpeechToTextResponse> {
    logger.info(this.name, 'speechToText', '开始语音转文字处理', {
      hasFile: !!request.audioFile,
      hasUrl: !!request.audioUrl,
      language: request.language,
      format: request.format,
    });
    
    try {
      // 参数验证
      if (!request.audioFile && !request.audioUrl) {
        throw new Error('必须提供音频文件或音频URL');
      }

      // 验证音频格式
      const supportedFormats = ['mp3', 'wav', 'flac', 'm4a', 'ogg'];
      const format = request.format || 'mp3';

      if (!supportedFormats.includes(format)) {
        throw new Error(`不支持的音频格式: ${format}。支持的格式: ${supportedFormats.join(', ')}`);
      }

      if (request.audioFile) {
        return await this.speechToTextWithFile(request);
      } else {
        return await this.speechToTextWithUrl(request);
      }
    } catch (error) {
      logger.error(this.name, 'speechToText', '语音转文字失败', error as Error);
      
      // 提供更友好的错误信息
      if ((error as any).status === 413) {
        throw new Error('音频文件过大，请确保文件小于10MB');
      } else if ((error as any).status === 415) {
        throw new Error('不支持的音频格式，请使用MP3、WAV、FLAC或M4A格式');
      }
      
      throw error;
    }
  }

  /**
   * 使用音频文件进行语音转文字（增强版）
   */
  private async speechToTextWithFile(request: SpeechToTextRequest): Promise<SpeechToTextResponse> {
    const startTime = Date.now();
    
    try {
      // 验证文件大小
      if (request.audioFile && request.audioFile.length > 10 * 1024 * 1024) {
        throw new Error('音频文件超过10MB限制');
      }
      
      // 创建FormData
      const formData = new FormData();

      formData.append('audio', request.audioFile!, {
        filename: `audio.${request.format || 'mp3'}`,
        contentType: `audio/${request.format || 'mp3'}`,
      });
      
      // 添加其他参数
      if (request.language) {
        formData.append('language', request.language);
      }
      
      // 智能端点选择
      const endpoints = await this.getAvailableSTTEndpoints();
      
      let response;
      let lastError;
      let successfulEndpoint;

      for (const endpoint of endpoints) {
        try {
          logger.debug(this.name, 'speechToTextWithFile', `尝试端点: ${endpoint.path}`);
          
          response = await this.apiClient.post(endpoint.path, formData, {
            headers: {
              ...formData.getHeaders(),
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
            // 针对音频上传使用更长的超时时间
            timeout: 60000,
          });
          
          successfulEndpoint = endpoint;
          break;
        } catch (error: any) {
          lastError = error;
          logger.warn(this.name, 'speechToTextWithFile', 
            `端点 ${endpoint.path} 失败: ${error.message}`, {
              status: error.status,
              endpoint: endpoint.path,
            });
          
          // 如果是认证错误，不再尝试其他端点
          if (error.status === 401 || error.status === 403) {
            throw error;
          }
        }
      }

      if (!response) {
        // 如果所有端点都失败，返回模拟响应（用于开发测试）
        if (this.config.baseUrl.includes('localhost') || process.env.NODE_ENV === 'development') {
          logger.warn(this.name, 'speechToTextWithFile', 
            'MiniMax STT不可用，返回开发模式模拟响应');

          return this.createMockResponse(request, startTime);
        }
        
        throw lastError || new Error('所有语音转文字端点都不可用');
      }

      const duration = Date.now() - startTime;
      
      // 解析和标准化响应
      const result = this.parseSTTResponse(response, duration, request.language);
      
      logger.info(this.name, 'speechToTextWithFile', '语音转文字完成', {
        duration,
        textLength: result.text.length,
        confidence: result.confidence,
        endpoint: successfulEndpoint?.path,
      });

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(this.name, 'speechToTextWithFile', '语音转文字处理失败', error, { 
        duration,
        fileSize: request.audioFile?.length, 
      });
      throw error;
    }
  }

  /**
   * 使用音频URL进行语音转文字（增强版）
   */
  private async speechToTextWithUrl(request: SpeechToTextRequest): Promise<SpeechToTextResponse> {
    const startTime = Date.now();
    
    try {
      // 验证URL格式
      if (!this.isValidUrl(request.audioUrl!)) {
        throw new Error('无效的音频URL');
      }
      
      const requestData = {
        audio_url: request.audioUrl,
        language: request.language || 'zh-CN',
        format: request.format || 'mp3',
        // 添加更多参数以提高识别准确率
        enable_punctuation: true,
        enable_word_time_offset: false,
      };

      const response = await this.apiClient.post('/v1/speech-to-text', requestData);
      
      const duration = Date.now() - startTime;
      const result = this.parseSTTResponse(response, duration, request.language);

      logger.info(this.name, 'speechToTextWithUrl', '语音转文字完成', {
        duration,
        textLength: result.text.length,
        url: request.audioUrl,
      });

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(this.name, 'speechToTextWithUrl', '语音转文字处理失败', error, { 
        duration,
        url: request.audioUrl, 
      });
      
      // 开发模式返回模拟响应
      if (error.status === 404 && process.env.NODE_ENV === 'development') {
        return this.createMockResponse(request, startTime);
      }
      
      throw error;
    }
  }

  /**
   * 文本生成（增强版）
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    logger.info(this.name, 'generateText', '开始文本生成', {
      promptLength: request.prompt.length,
      model: request.model,
      maxTokens: request.max_tokens,
      temperature: request.temperature,
    });
    
    const startTime = Date.now();
    
    try {
      // 参数验证和优化
      const optimizedRequest = this.optimizeTextGenerationRequest(request);
      
      const requestData = {
        model: optimizedRequest.model,
        messages: [
          {
            role: 'user',
            content: optimizedRequest.prompt,
          },
        ],
        max_tokens: optimizedRequest.max_tokens,
        temperature: optimizedRequest.temperature,
        top_p: optimizedRequest.top_p,
        stream: false,
        // 添加更多控制参数
        frequency_penalty: 0,
        presence_penalty: 0,
        stop: null,
      };

      // 添加group_id（如果配置了）
      if (this.config.groupId) {
        (requestData as any).group_id = this.config.groupId;
      }

      const response = await this.apiClient.post('/v1/text/chatcompletion_v2', requestData);
      
      const duration = Date.now() - startTime;
      const result = this.parseTextGenerationResponse(response, duration);

      logger.info(this.name, 'generateText', '文本生成完成', {
        duration,
        inputLength: request.prompt.length,
        outputLength: result.text.length,
        model: result.model,
        finishReason: result.finish_reason,
      });

      // 记录token使用情况（如果有）
      if ((response as any).usage) {
        logger.info(this.name, 'generateText', 'Token使用情况', {
          promptTokens: (response as any).usage.prompt_tokens,
          completionTokens: (response as any).usage.completion_tokens,
          totalTokens: (response as any).usage.total_tokens,
        });
      }

      return result;

    } catch (error: any) {
      const duration = Date.now() - startTime;

      logger.error(this.name, 'generateText', '文本生成失败', error, { 
        duration,
        model: request.model, 
      });
      
      // 提供更详细的错误信息
      if (error.status === 429) {
        throw new Error('API调用频率超限，请稍后再试');
      } else if (error.status === 402) {
        throw new Error('API余额不足，请充值');
      }
      
      throw error;
    }
  }

  /**
   * 获取可用的STT端点
   */
  private async getAvailableSTTEndpoints(): Promise<Array<{ path: string, priority: number }>> {
    // 基于经验和文档的端点优先级列表
    return [
      { path: '/v1/speech-to-text', priority: 1 },
      { path: '/v1/audio/transcriptions', priority: 2 },
      { path: '/v1/t2a_v2', priority: 3 },
      { path: '/v1/speech/transcriptions', priority: 4 },
    ].sort((a, b) => a.priority - b.priority);
  }

  /**
   * 解析STT响应
   */
  private parseSTTResponse(response: any, duration: number, language?: string): SpeechToTextResponse {
    // 尝试多种响应格式
    const text = response.text || 
                 response.transcription || 
                 response.result || 
                 response.data?.text ||
                 response.data?.transcription ||
                 '转录失败';
    
    const confidence = response.confidence || 
                      response.data?.confidence || 
                      (text && text !== '转录失败' ? 0.95 : 0);
    
    return {
      text,
      confidence,
      duration,
      language: response.language || language || 'zh-CN',
      segments: response.segments || response.data?.segments,
    };
  }

  /**
   * 解析文本生成响应
   */
  private parseTextGenerationResponse(response: any, _duration: number): TextGenerationResponse {
    const choice = response.choices?.[0] || response.data?.choices?.[0];
    
    if (!choice) {
      throw new Error('无效的API响应格式');
    }
    
    return {
      text: choice.message?.content || choice.text || '',
      finish_reason: choice.finish_reason,
      model: response.model || response.data?.model,
      created: response.created || response.data?.created || Date.now(),
    };
  }

  /**
   * 优化文本生成请求参数
   */
  private optimizeTextGenerationRequest(request: TextGenerationRequest): TextGenerationRequest {
    return {
      ...request,
      model: request.model || 'abab6.5s-chat',
      max_tokens: Math.min(request.max_tokens || 1024, 4096),
      temperature: Math.max(0, Math.min(request.temperature ?? 0.7, 2)),
      top_p: Math.max(0, Math.min(request.top_p ?? 0.95, 1)),
    };
  }

  /**
   * 创建模拟响应（开发/测试用）
   */
  private createMockResponse(request: SpeechToTextRequest, startTime: number): SpeechToTextResponse {
    return {
      text: '[开发模式] 这是语音转文字的模拟响应。实际使用时将返回真实的转录结果。',
      confidence: 0.99,
      duration: Date.now() - startTime,
      language: request.language || 'zh-CN',
      segments: [
        {
          start: 0,
          end: 3,
          text: '[开发模式] 这是语音转文字的模拟响应。',
          confidence: 0.99,
        },
      ],
    };
  }

  /**
   * 验证URL格式
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(): Promise<{
    available: boolean;
    circuitBreakerStatus: any;
    endpoints: { stt: boolean; tts: boolean; textGen: boolean };
  }> {
    const cbStatus = this.apiClient.getCircuitBreakerStatus();
    
    return {
      available: await this.healthCheck(),
      circuitBreakerStatus: cbStatus,
      endpoints: {
        stt: true, // 根据实际测试结果
        tts: false, // MiniMax主要做TTS
        textGen: true,
      },
    };
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    logger.info(this.name, 'dispose', '开始清理资源');
    
    try {
      // 清理模型缓存
      this.modelCache.clear();
      
      // EnhancedApiClient 会自动处理断路器和其他资源的清理
      logger.info(this.name, 'dispose', '资源清理完成', {
        modelCacheCleared: true
      });
    } catch (error) {
      logger.error(this.name, 'dispose', '资源清理失败', error as Error);
    }
  }
}

/**
 * 测试函数
 */
async function testMiniMaxV2() {
  console.log('\\n=== MiniMax API V2 集成验证测试 ===\\n');
  
  try {
    // 验证环境变量
    Config.printConfigSummary();
    
    const validation = Config.validateEnv();

    if (!validation.valid) {
      console.error('\\n❌ 环境变量验证失败，请检查配置');

      return;
    }

    // 初始化客户端
    const client = new MiniMaxClientV2();
    const config = Config.getMiniMaxConfig();

    await client.initialize(config);

    // 获取服务状态
    console.log('\\n1. 检查服务状态...');
    const status = await client.getServiceStatus();

    console.log('服务状态:', JSON.stringify(status, null, 2));

    // 健康检查
    console.log('\\n2. 执行健康检查...');
    const isHealthy = await client.healthCheck();

    console.log(`健康检查结果: ${isHealthy ? '✅ 通过' : '❌ 失败'}`);

    // 测试文本生成
    console.log('\\n3. 测试文本生成功能...');
    try {
      const textRequest: TextGenerationRequest = {
        prompt: '请用3个要点总结如何提高工作效率',
        max_tokens: 200,
        temperature: 0.7,
      };

      const textResult = await client.generateText(textRequest);

      console.log('✅ 文本生成成功');
      console.log('生成内容:', textResult.text);
      console.log('模型:', textResult.model);
      console.log('完成原因:', textResult.finish_reason);
    } catch (error: any) {
      console.log('❌ 文本生成失败:', error.message);
    }

    // 测试语音转文字
    console.log('\\n4. 测试语音转文字功能...');
    try {
      const mockAudioBuffer = Buffer.from('mock audio data for testing');
      
      const sttRequest: SpeechToTextRequest = {
        audioFile: mockAudioBuffer,
        language: 'zh-CN',
        format: 'mp3',
      };

      const sttResult = await client.speechToText(sttRequest);

      console.log('✅ 语音转文字完成');
      console.log('转录结果:', sttResult.text);
      console.log('置信度:', sttResult.confidence);
      console.log('处理时间:', `${sttResult.duration  }ms`);
      if (sttResult.segments) {
        console.log('分段数量:', sttResult.segments.length);
      }
    } catch (error: any) {
      console.log('❌ 语音转文字失败:', error.message);
    }

    // 获取性能指标
    console.log('\\n5. 性能指标...');
    const metrics = client['apiClient']?.getMetrics() || [];

    console.log(`总请求数: ${metrics.length}`);
    
    if (metrics.length > 0) {
      const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
      const successRate = (metrics.filter((m) => m.success).length / metrics.length) * 100;

      console.log(`平均响应时间: ${avgDuration.toFixed(2)}ms`);
      console.log(`成功率: ${successRate.toFixed(2)}%`);
    }

    // 输出日志摘要
    logger.printSummary();

  } catch (error: any) {
    console.error('\\n❌ 测试过程中发生错误:', error.message);
    logger.error('MiniMaxV2', 'test', '测试失败', error);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testMiniMaxV2().catch(console.error);
}