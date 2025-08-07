import { MiniMaxClientV2 } from '../clients/minimax-client-v2';
// YunmaoClient 和 IflytekClient 已废弃，移至 archive/deprecated-services
import { logger } from '../utils/logger';

/**
 * 转录服务提供商类型
 */
export type TranscriptionProvider = 'minimax' | 'yunmao' | 'aliyun' | 'iflytek';

/**
 * 转录请求参数
 */
export interface TranscriptionRequest {
  videoUrl?: string;           // 视频URL（云猫转码使用）
  audioUrl?: string;           // 音频URL（直接音频链接）
  audioPath?: string;          // 音频文件路径（MiniMax等使用）
  language?: string;           // 语言代码
  provider?: TranscriptionProvider; // 指定服务提供商
  options?: {
    dialogueMode?: boolean;    // 对话模式
    speakerCount?: number;     // 说话人数量
    outputFormat?: string;     // 输出格式
    [key: string]: any;        // 其他特定提供商的选项
  };
}

/**
 * 转录结果
 */
export interface TranscriptionResult {
  text: string;                // 转录文本
  provider: TranscriptionProvider; // 使用的服务提供商
  duration?: number;           // 音视频时长（秒）
  wordCount?: number;          // 字数统计
  confidence?: number;         // 置信度
  metadata?: {
    taskId?: string;           // 任务ID
    processingTime?: number;   // 处理时间（毫秒）
    [key: string]: any;
  };
}

/**
 * 提供商配置
 */
interface ProviderConfig {
  enabled: boolean;
  priority: number;  // 优先级（数字越小优先级越高）
  config: any;
}

/**
 * 转录服务提供商管理器
 * 管理多个转录服务，实现负载均衡和故障转移
 */
export class TranscriptionProviderManager {
  private providers: Map<TranscriptionProvider, ProviderConfig> = new Map();
  private clients: Map<TranscriptionProvider, any> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * 初始化服务提供商
   */
  private initializeProviders(): void {
    // MiniMax 配置
    if (process.env.MINIMAX_API_KEY) {
      this.providers.set('minimax', {
        enabled: true,
        priority: 2,
        config: {
          apiKey: process.env.MINIMAX_API_KEY,
          groupId: process.env.MINIMAX_GROUP_ID
        }
      });
    }

    // 云猫转码配置
    if (process.env.YUNMAO_API_KEY) {
      this.providers.set('yunmao', {
        enabled: true,
        priority: 1, // 云猫优先级更高（支持视频直接处理）
        config: {
          apiKey: process.env.YUNMAO_API_KEY,
          apiSecret: process.env.YUNMAO_API_SECRET
        }
      });
    }

    // 阿里云配置（预留）
    if (process.env.ALIYUN_API_KEY) {
      this.providers.set('aliyun', {
        enabled: false, // 暂未实现
        priority: 3,
        config: {
          apiKey: process.env.ALIYUN_API_KEY
        }
      });
    }

    // 讯飞配置
    if (process.env.IFLYTEK_APP_ID) {
      this.providers.set('iflytek', {
        enabled: true, // 已实现
        priority: 4,
        config: {
          appId: process.env.IFLYTEK_APP_ID,
          apiSecret: process.env.IFLYTEK_API_SECRET,
          apiKey: process.env.IFLYTEK_API_KEY
        }
      });
    }

    logger.info('TranscriptionProviderManager', 'initialize', '初始化服务提供商', {
      providers: Array.from(this.providers.entries()).map(([name, config]) => ({
        name,
        enabled: config.enabled,
        priority: config.priority
      }))
    });
  }

  /**
   * 获取或创建客户端实例
   */
  private getClient(provider: TranscriptionProvider): any {
    if (!this.clients.has(provider)) {
      const config = this.providers.get(provider);
      if (!config || !config.enabled) {
        throw new Error(`服务提供商 ${provider} 未启用`);
      }

      switch (provider) {
        case 'minimax':
          this.clients.set(provider, new MiniMaxClientV2());
          break;
        case 'yunmao':
          throw new Error('云猫转码服务已废弃，请使用 minimax 或其他服务');
        case 'iflytek':
          throw new Error('科大讯飞服务已废弃，请使用 minimax 或其他服务');
        default:
          throw new Error(`服务提供商 ${provider} 尚未实现`);
      }
    }

    return this.clients.get(provider);
  }

  /**
   * 执行转录
   */
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    // 如果指定了提供商，直接使用
    if (request.provider) {
      return await this.transcribeWithProvider(request.provider, request, startTime);
    }

    // 获取可用的提供商列表（按优先级排序）
    const availableProviders = this.getAvailableProviders(request);
    
    if (availableProviders.length === 0) {
      throw new Error('没有可用的转录服务提供商');
    }

    // 尝试每个提供商，直到成功
    let lastError: Error | null = null;
    
    for (const provider of availableProviders) {
      try {
        logger.info('TranscriptionProviderManager', 'transcribe', `尝试使用 ${provider}`, {
          provider,
          hasVideo: !!request.videoUrl,
          hasAudio: !!request.audioPath
        });

        return await this.transcribeWithProvider(provider, request, startTime);
      } catch (error) {
        logger.warn('TranscriptionProviderManager', 'transcribe', `${provider} 失败，尝试下一个`, {
          provider,
          error: error instanceof Error ? error.message : String(error)
        });
        lastError = error as Error;
      }
    }

    // 所有提供商都失败了
    throw new Error(`所有转录服务都失败了: ${lastError?.message || '未知错误'}`);
  }

  /**
   * 使用指定提供商进行转录
   */
  private async transcribeWithProvider(
    provider: TranscriptionProvider,
    request: TranscriptionRequest,
    startTime: number
  ): Promise<TranscriptionResult> {
    const client = this.getClient(provider);

    switch (provider) {
      case 'minimax': {
        if (!request.audioPath) {
          throw new Error('MiniMax 需要音频文件路径');
        }

        const result = await client.transcribeAudio({
          audioPath: request.audioPath,
          language: request.language
        });

        return {
          text: result.text,
          provider: 'minimax',
          metadata: {
            taskId: result.baseResp?.trace_id,
            processingTime: Date.now() - startTime
          }
        };
      }

      case 'yunmao': {
        throw new Error('云猫转码服务已废弃，请使用 minimax 或腾讯云 ASR 服务');
      }

      case 'iflytek': {
        throw new Error('科大讯飞服务已废弃，请使用 minimax 或腾讯云 ASR 服务');
      }

      default:
        throw new Error(`服务提供商 ${provider} 尚未实现`);
    }
  }

  /**
   * 获取可用的提供商列表
   */
  private getAvailableProviders(request: TranscriptionRequest): TranscriptionProvider[] {
    const providers: Array<[TranscriptionProvider, ProviderConfig]> = [];

    // 根据请求类型筛选合适的提供商
    for (const [name, config] of this.providers.entries()) {
      if (!config.enabled) continue;

      // 云猫转码只支持视频URL
      if (name === 'yunmao' && !request.videoUrl) continue;
      
      // MiniMax和讯飞只支持音频文件
      if ((name === 'minimax' || name === 'iflytek') && !request.audioPath && !request.audioUrl) continue;

      providers.push([name, config]);
    }

    // 按优先级排序
    providers.sort((a, b) => a[1].priority - b[1].priority);

    return providers.map(p => p[0]);
  }

  /**
   * 获取服务状态
   */
  getStatus(): Record<TranscriptionProvider, { enabled: boolean; priority: number }> {
    const status: any = {};
    
    for (const [name, config] of this.providers.entries()) {
      status[name] = {
        enabled: config.enabled,
        priority: config.priority
      };
    }

    return status;
  }

  /**
   * 启用/禁用服务提供商
   */
  setProviderEnabled(provider: TranscriptionProvider, enabled: boolean): void {
    const config = this.providers.get(provider);
    if (config) {
      config.enabled = enabled;
      logger.info('TranscriptionProviderManager', 'setProviderEnabled', '更新提供商状态', {
        provider,
        enabled
      });
    }
  }

  /**
   * 设置服务提供商优先级
   */
  setProviderPriority(provider: TranscriptionProvider, priority: number): void {
    const config = this.providers.get(provider);
    if (config) {
      config.priority = priority;
      logger.info('TranscriptionProviderManager', 'setProviderPriority', '更新提供商优先级', {
        provider,
        priority
      });
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    for (const client of this.clients.values()) {
      if (client.dispose) {
        client.dispose();
      }
    }
    this.clients.clear();
  }
}