import { readFileSync } from 'fs';

import { SpeechToTextRequest, SpeechToTextResponse } from '../interfaces/api-types';

import { MiniMaxClientV2 } from './minimax-client-v2';
import { Config } from './config';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence: number;
  }>;
  processingTime: number;
}

export interface AudioTranscriberError extends Error {
  code: string;
  details?: any;
}

export class AudioTranscriber {
  private miniMaxClient: MiniMaxClientV2;
  private initialized = false;

  constructor() {
    this.miniMaxClient = new MiniMaxClientV2();
  }

  private createError(code: string, message: string, details?: any): AudioTranscriberError {
    const error = new Error(message) as AudioTranscriberError;

    error.code = code;
    error.details = details;

    return error;
  }

  /**
   * 初始化音频转写客户端
   */
  async initialize(): Promise<void> {
    if (this.initialized) {return;}

    try {
      // 从环境变量获取 MiniMax 配置
      const baseConfig = Config.getMiniMaxConfig();
      
      const miniMaxConfig = {
        name: 'MiniMax',
        baseUrl: baseConfig.baseUrl,
        apiKey: baseConfig.apiKey,
        timeout: 60000, // 60 秒超时，适合音频处理
        retryAttempts: baseConfig.maxRetries || 3,
        retryDelay: baseConfig.retryDelayBase || 1000,
        maxConcurrent: 2,
      };

      // 验证必需的配置
      if (!miniMaxConfig.apiKey) {
        throw this.createError(
          'MISSING_API_KEY', 
          'MiniMax API 密钥未配置，请设置 MINIMAX_API_KEY 环境变量',
        );
      }

      await this.miniMaxClient.initialize(miniMaxConfig);
      this.initialized = true;
      
      console.log('✅ 音频转写客户端初始化成功');

    } catch (error) {
      console.error('❌ 音频转写客户端初始化失败:', error);
      
      if (error instanceof Error && (error as AudioTranscriberError).code) {
        throw error;
      }

      throw this.createError(
        'INITIALIZATION_FAILED',
        '音频转写客户端初始化失败',
        { originalError: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  /**
   * 转写音频文件为文字
   */
  async transcribeAudioFile(audioPath: string): Promise<TranscriptionResult> {
    await this.initialize();

    const startTime = Date.now();

    try {
      console.log(`🎵 开始转写音频文件: ${audioPath}`);

      // 读取音频文件
      let audioBuffer: Buffer;

      try {
        audioBuffer = readFileSync(audioPath);
      } catch (error) {
        throw this.createError(
          'FILE_READ_ERROR',
          '无法读取音频文件',
          { audioPath, error: error instanceof Error ? error.message : String(error) },
        );
      }

      // 验证文件大小（MiniMax 限制 10MB）
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (audioBuffer.length > maxSize) {
        throw this.createError(
          'FILE_TOO_LARGE',
          '音频文件过大，超过10MB限制',
          { 
            fileSize: audioBuffer.length, 
            maxSize,
            audioPath, 
          },
        );
      }

      // 从文件路径推断音频格式
      const format = this.inferAudioFormat(audioPath);
      
      // 构建转写请求
      const request: SpeechToTextRequest = {
        audioFile: audioBuffer,
        language: 'zh-CN', // 默认中文
        format: format as 'mp3' | 'wav' | 'flac' | 'm4a',
      };

      // 调用 MiniMax API
      const response: SpeechToTextResponse = await this.miniMaxClient.speechToText(request);

      const processingTime = Date.now() - startTime;

      // 转换为标准格式
      const result: TranscriptionResult = {
        text: response.text,
        confidence: response.confidence || 0,
        duration: response.duration || 0,
        segments: response.segments?.map((seg) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
          confidence: seg.confidence || 0,
        })),
        processingTime,
      };

      console.log(`✅ 音频转写完成: ${processingTime}ms`);
      console.log(`📝 转写文字长度: ${result.text.length} 字符`);
      console.log(`🎯 置信度: ${(result.confidence * 100).toFixed(1)}%`);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      console.error(`❌ 音频转写失败 (${processingTime}ms):`, error);

      // 处理已知错误类型
      if (error instanceof Error && (error as AudioTranscriberError).code) {
        throw error;
      }

      // 处理 MiniMax API 特定错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('音频文件过大')) {
        throw this.createError('FILE_TOO_LARGE', errorMessage, { audioPath });
      }
      
      if (errorMessage.includes('不支持的音频格式')) {
        throw this.createError('UNSUPPORTED_FORMAT', errorMessage, { audioPath, format: this.inferAudioFormat(audioPath) });
      }
      
      if (errorMessage.includes('API密钥')) {
        throw this.createError('INVALID_API_KEY', 'MiniMax API 密钥无效或已过期', { audioPath });
      }
      
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        throw this.createError('API_QUOTA_EXCEEDED', 'MiniMax API 配额已用完', { audioPath });
      }

      // 通用转写失败错误
      throw this.createError(
        'TRANSCRIPTION_FAILED',
        '音频转写失败',
        { 
          audioPath,
          processingTime,
          originalError: errorMessage,
        },
      );
    }
  }

  /**
   * 从文件路径推断音频格式
   */
  private inferAudioFormat(audioPath: string): string {
    const extension = audioPath.toLowerCase().split('.').pop();
    
    switch (extension) {
      case 'mp3':
        return 'mp3';
      case 'wav':
        return 'wav';
      case 'flac':
        return 'flac';
      case 'm4a':
        return 'm4a';
      case 'ogg':
        return 'ogg';
      default:
        // 默认假设是 mp3（我们的音频提取默认格式）
        return 'mp3';
    }
  }

  /**
   * 验证音频格式是否受支持
   */
  private isSupportedFormat(format: string): boolean {
    const supportedFormats = ['mp3', 'wav', 'flac', 'm4a', 'ogg'];

    return supportedFormats.includes(format.toLowerCase());
  }

  /**
   * 获取客户端状态信息
   */
  async getStatus(): Promise<{
    initialized: boolean;
    clientName: string;
    supportedFormats: string[];
    maxFileSize: string;
  }> {
    return {
      initialized: this.initialized,
      clientName: this.miniMaxClient.name,
      supportedFormats: ['mp3', 'wav', 'flac', 'm4a', 'ogg'],
      maxFileSize: '10MB',
    };
  }

  /**
   * 批量转写多个音频文件
   */
  async transcribeMultipleFiles(audioPaths: string[]): Promise<TranscriptionResult[]> {
    const results: TranscriptionResult[] = [];
    
    for (const audioPath of audioPaths) {
      try {
        const result = await this.transcribeAudioFile(audioPath);

        results.push(result);
      } catch (error) {
        console.error(`音频文件 ${audioPath} 转写失败:`, error);
        // 继续处理下一个文件，但记录错误
        results.push({
          text: '',
          confidence: 0,
          duration: 0,
          processingTime: 0,
          // 在实际使用中，可能需要包含错误信息
        });
      }
    }
    
    return results;
  }

  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    try {
      // 清理 MiniMaxClient 资源
      if (this.miniMaxClient && typeof this.miniMaxClient.dispose === 'function') {
        await this.miniMaxClient.dispose();
      }
      
      this.initialized = false;
      console.log('🗑️  音频转写客户端资源已释放');
    } catch (error) {
      console.error('清理音频转写器资源时出错:', error);
    }
  }
}