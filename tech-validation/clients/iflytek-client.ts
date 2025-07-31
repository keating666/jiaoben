/**
 * 讯飞语音识别客户端
 * 支持 Node.js 和 Cloudflare Workers 环境
 * 
 * Cloudflare Workers 使用说明：
 * 1. 在 wrangler.toml 中添加: compatibility_flags = ["nodejs_compat"]
 * 2. 使用 node: 前缀导入: import crypto from 'node:crypto'
 */

// 环境检测
const isCloudflareWorkers = typeof globalThis !== 'undefined' && 
  'ServiceWorkerGlobalScope' in globalThis;

// 条件导入处理
import type { AIServiceClient, ServiceConfig, SpeechToTextRequest, SpeechToTextResponse, TextGenerationRequest, TextGenerationResponse } from '../interfaces/api-types';
import { logger } from '../utils/logger';
import { Config } from '../utils/config';

// Node.js 环境导入
let crypto: typeof import('crypto');
let WebSocket: typeof import('ws').default;

if (!isCloudflareWorkers) {
  crypto = require('crypto');
  WebSocket = require('ws');
}

/**
 * 讯飞配置接口
 */
interface IflytekConfig extends ServiceConfig {
  appId: string;
  apiSecret: string;
  apiKey: string;
}

/**
 * 讯飞语音识别客户端实现
 */
export class IflytekClient implements AIServiceClient {
  name = 'Iflytek-ASR';
  private config!: IflytekConfig;
  private wsUrl = 'wss://ws-api.xfyun.cn/v2/iat';
  private cryptoModule: any;
  
  /**
   * 初始化客户端
   */
  async initialize(config: ServiceConfig): Promise<void> {
    // 动态加载 crypto 模块
    if (isCloudflareWorkers) {
      // Cloudflare Workers 环境
      this.cryptoModule = await import('node:crypto');
    } else {
      // Node.js 环境
      this.cryptoModule = crypto;
    }
    
    // 从环境变量加载讯飞特定配置
    this.config = {
      ...config,
      appId: Config.get('IFLYTEK_APP_ID'),
      apiSecret: Config.get('IFLYTEK_API_SECRET'),
      apiKey: Config.get('IFLYTEK_API_KEY'),
    } as IflytekConfig;
    
    if (!this.config.appId || !this.config.apiSecret || !this.config.apiKey) {
      throw new Error('讯飞语音识别服务配置不完整，请检查环境变量');
    }
    
    logger.info(this.name, 'initialize', '客户端初始化完成', { 
      appId: this.config.appId,
      wsUrl: this.wsUrl,
      environment: isCloudflareWorkers ? 'Cloudflare Workers' : 'Node.js',
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      logger.info(this.name, 'healthCheck', '开始健康检查');
      
      // 生成认证URL
      const authUrl = await this.generateAuthUrl();
      
      // Cloudflare Workers 环境下的健康检查
      if (isCloudflareWorkers) {
        // 在 Workers 中，我们只验证能否生成有效的认证 URL
        return authUrl.startsWith('wss://ws-api.xfyun.cn');
      }
      
      // Node.js 环境下的 WebSocket 健康检查
      return new Promise((resolve) => {
        const ws = new WebSocket(authUrl);
        
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          logger.info(this.name, 'healthCheck', '健康检查通过');
          resolve(true);
        });
        
        ws.on('error', (error: Error) => {
          clearTimeout(timeout);
          logger.error(this.name, 'healthCheck', '健康检查失败', error);
          resolve(false);
        });
      });
    } catch (error) {
      logger.error(this.name, 'healthCheck', '健康检查异常', error as Error);
      return false;
    }
  }

  /**
   * 语音转文字
   */
  async speechToText(request: SpeechToTextRequest): Promise<SpeechToTextResponse> {
    const startTime = Date.now();
    
    try {
      logger.info(this.name, 'speechToText', '开始语音识别', {
        hasAudioFile: !!request.audioFile,
        hasAudioUrl: !!request.audioUrl,
        language: request.language || 'zh-CN',
      });
      
      // 获取音频数据
      const audioData = await this.getAudioData(request);
      
      // 执行语音识别
      const result = await this.performRecognition(audioData, request);
      
      const duration = Date.now() - startTime;
      logger.info(this.name, 'speechToText', '语音识别完成', {
        textLength: result.text.length,
        duration,
      });
      
      return result;
    } catch (error) {
      logger.error(this.name, 'speechToText', '语音识别失败', error as Error);
      throw error;
    }
  }

  /**
   * 文本生成（讯飞语音识别不支持此功能）
   */
  async generateText?(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    throw new Error('讯飞语音识别客户端不支持文本生成功能');
  }

  /**
   * 生成认证URL（核心签名逻辑）
   */
  private async generateAuthUrl(): Promise<string> {
    const host = 'ws-api.xfyun.cn';
    const path = '/v2/iat';
    
    // 生成 RFC1123 格式的时间戳
    const date = new Date().toUTCString();
    
    // 生成签名原文
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    
    // 使用 hmac-sha256 进行加密
    let signatureSha: string;
    
    if (isCloudflareWorkers) {
      // Cloudflare Workers 环境使用 Web Crypto API 风格
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.config.apiSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(signatureOrigin)
      );
      
      signatureSha = btoa(String.fromCharCode(...new Uint8Array(signature)));
    } else {
      // Node.js 环境
      signatureSha = this.cryptoModule
        .createHmac('sha256', this.config.apiSecret)
        .update(signatureOrigin)
        .digest('base64');
    }
    
    // 构建 authorization 参数
    const authorizationOrigin = `api_key="${this.config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');
    
    // 构建最终的认证 URL
    const url = new URL(this.wsUrl);
    url.searchParams.append('authorization', authorization);
    url.searchParams.append('date', date);
    url.searchParams.append('host', host);
    
    return url.toString();
  }

  /**
   * 获取音频数据
   */
  private async getAudioData(request: SpeechToTextRequest): Promise<Buffer> {
    if (request.audioFile) {
      return request.audioFile;
    }
    
    if (request.audioUrl) {
      // 从URL下载音频文件
      const response = await fetch(request.audioUrl);
      if (!response.ok) {
        throw new Error(`无法下载音频文件: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
    
    throw new Error('请提供音频文件或音频URL');
  }

  /**
   * 执行语音识别（Node.js 环境）
   */
  private async performRecognition(
    audioData: Buffer,
    request: SpeechToTextRequest
  ): Promise<SpeechToTextResponse> {
    // Cloudflare Workers 环境暂不支持 WebSocket 客户端
    if (isCloudflareWorkers) {
      throw new Error('Cloudflare Workers 环境暂不支持 WebSocket 客户端连接，请使用 HTTP API 或在服务器端执行');
    }
    
    return new Promise(async (resolve, reject) => {
      const authUrl = await this.generateAuthUrl();
      const ws = new WebSocket(authUrl);
      
      let recognitionResult = '';
      const segments: any[] = [];
      let isCompleted = false;
      
      // 设置超时
      const timeout = setTimeout(() => {
        if (!isCompleted) {
          ws.close();
          reject(new Error('语音识别超时'));
        }
      }, 60000); // 60秒超时
      
      ws.on('open', () => {
        logger.debug(this.name, 'performRecognition', 'WebSocket连接已建立');
        
        // 发送配置帧
        const configFrame = {
          common: {
            app_id: this.config.appId,
          },
          business: {
            language: this.getLanguageCode(request.language),
            domain: 'iat',
            accent: 'mandarin',
            vad_eos: 3000,
            dwa: 'wpgs',
            result_level: 'plain',
            result_encoding: 'utf8',
          },
          data: {
            status: 0,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: audioData.toString('base64'),
          },
        };
        
        ws.send(JSON.stringify(configFrame));
        
        // 发送音频数据（分片发送）
        const chunkSize = 1280; // 每次发送40ms的音频数据
        const chunks = Math.ceil(audioData.length / chunkSize);
        
        for (let i = 0; i < chunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, audioData.length);
          const chunk = audioData.slice(start, end);
          
          const dataFrame = {
            data: {
              status: i === chunks - 1 ? 2 : 1, // 最后一片状态为2
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: chunk.toString('base64'),
            },
          };
          
          ws.send(JSON.stringify(dataFrame));
        }
      });
      
      ws.on('message', (data: any) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.code !== 0) {
            throw new Error(`讯飞API错误: ${response.message}`);
          }
          
          if (response.data && response.data.result) {
            const result = response.data.result;
            
            // 解析识别结果
            if (result.ws) {
              result.ws.forEach((word: any) => {
                word.cw.forEach((char: any) => {
                  recognitionResult += char.w;
                });
              });
            }
            
            // 检查是否结束
            if (response.data.status === 2) {
              isCompleted = true;
              clearTimeout(timeout);
              ws.close();
              
              resolve({
                text: recognitionResult.trim(),
                segments,
                language: request.language || 'zh-CN',
              });
            }
          }
        } catch (error) {
          reject(error);
        }
      });
      
      ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
      
      ws.on('close', () => {
        clearTimeout(timeout);
        if (!isCompleted) {
          reject(new Error('WebSocket连接意外关闭'));
        }
      });
    });
  }

  /**
   * 获取讯飞语言代码
   */
  private getLanguageCode(language?: string): string {
    const languageMap: Record<string, string> = {
      'zh-CN': 'zh_cn',
      'zh-TW': 'zh_tw',
      'en-US': 'en_us',
      'ja-JP': 'ja_jp',
      'ko-KR': 'ko_kr',
    };
    
    return languageMap[language || 'zh-CN'] || 'zh_cn';
  }

  /**
   * 清理资源
   */
  dispose(): void {
    logger.info(this.name, 'dispose', '清理客户端资源');
  }
}

/**
 * 创建 Cloudflare Workers 兼容的认证函数
 * 可以在 Workers 中直接使用，无需 WebSocket
 */
export async function generateIflytekAuthHeaders(
  appId: string,
  apiKey: string,
  apiSecret: string
): Promise<{ authorization: string; date: string; host: string }> {
  const host = 'ws-api.xfyun.cn';
  const path = '/v2/iat';
  const date = new Date().toUTCString();
  
  // 生成签名
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  
  let signatureSha: string;
  
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Web Crypto API (Cloudflare Workers with nodejs_compat)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(apiSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signatureOrigin)
    );
    
    signatureSha = btoa(String.fromCharCode(...new Uint8Array(signature)));
  } else {
    // Node.js crypto
    const nodeCrypto = require('crypto');
    signatureSha = nodeCrypto
      .createHmac('sha256', apiSecret)
      .update(signatureOrigin)
      .digest('base64');
  }
  
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  const authorization = btoa(authorizationOrigin);
  
  return { authorization, date, host };
}