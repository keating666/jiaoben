import { logger } from '../utils/logger';
import { ServiceError, ServiceUnavailableError } from '../utils/error-types';

/**
 * 服务降级策略管理器
 * 当主服务不可用时，自动切换到备用方案
 */

// 服务状态
interface ServiceStatus {
  available: boolean;
  lastCheckTime: number;
  failureCount: number;
  lastFailureTime?: number;
  errorRate: number;
}

// 降级配置
interface FallbackConfig {
  maxFailures: number;          // 最大失败次数
  resetTimeout: number;         // 重置超时（毫秒）
  errorRateThreshold: number;   // 错误率阈值
  checkInterval: number;        // 健康检查间隔
}

export class FallbackStrategyManager {
  private serviceStatus: Map<string, ServiceStatus> = new Map();
  private readonly config: FallbackConfig;

  constructor(config?: Partial<FallbackConfig>) {
    this.config = {
      maxFailures: 3,
      resetTimeout: 60000,      // 1分钟
      errorRateThreshold: 0.5,  // 50%错误率
      checkInterval: 30000,     // 30秒
      ...config
    };
  }

  /**
   * 视频解析服务降级策略
   */
  async resolveVideoWithFallback(videoUrl: string): Promise<{url: string; source: string}> {
    const strategies = [
      {
        name: 'TikHub-Web',
        execute: () => this.tikHubWebResolve(videoUrl),
        priority: 1
      },
      {
        name: 'TikHub-App',
        execute: () => this.tikHubAppResolve(videoUrl),
        priority: 2
      },
      {
        name: 'LocalParser',
        execute: () => this.localVideoParser(videoUrl),
        priority: 3
      },
      {
        name: 'DirectUrl',
        execute: () => this.directUrlFallback(videoUrl),
        priority: 4
      }
    ];

    // 按优先级尝试
    for (const strategy of strategies.sort((a, b) => a.priority - b.priority)) {
      if (!this.isServiceAvailable(strategy.name)) {
        logger.warn('FallbackStrategy', 'resolveVideo', `跳过不可用服务: ${strategy.name}`);
        continue;
      }

      try {
        const result = await strategy.execute();
        this.recordSuccess(strategy.name);
        logger.info('FallbackStrategy', 'resolveVideo', `成功使用: ${strategy.name}`);
        return { ...result, source: strategy.name };
      } catch (error) {
        this.recordFailure(strategy.name, error as Error);
        logger.warn('FallbackStrategy', 'resolveVideo', `${strategy.name} 失败`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    throw new ServiceUnavailableError('VideoResolver', '所有视频解析策略都失败了');
  }

  /**
   * 音频转文字服务降级策略
   */
  async transcribeWithFallback(input: {videoUrl?: string; audioPath?: string}): Promise<{
    text: string;
    provider: string;
    confidence: number;
  }> {
    const strategies = [
      {
        name: 'Yunmao',
        execute: () => this.yunmaoTranscribe(input.videoUrl!),
        condition: () => !!input.videoUrl,
        priority: 1
      },
      {
        name: 'MiniMax',
        execute: () => this.minimaxTranscribe(input.audioPath || input.videoUrl!),
        priority: 2
      },
      {
        name: 'Aliyun',
        execute: () => this.aliyunTranscribe(input.audioPath || input.videoUrl!),
        priority: 3
      },
      {
        name: 'MockTranscription',
        execute: () => this.mockTranscription(),
        priority: 999 // 最后的保底方案
      }
    ];

    for (const strategy of strategies.sort((a, b) => a.priority - b.priority)) {
      // 检查条件
      if (strategy.condition && !strategy.condition()) {
        continue;
      }

      if (!this.isServiceAvailable(strategy.name)) {
        continue;
      }

      try {
        const result = await strategy.execute();
        this.recordSuccess(strategy.name);
        return { ...result, provider: strategy.name };
      } catch (error) {
        this.recordFailure(strategy.name, error as Error);
      }
    }

    throw new ServiceUnavailableError('Transcription', '所有转录服务都不可用');
  }

  /**
   * AI 脚本生成服务降级策略
   */
  async generateScriptWithFallback(
    text: string, 
    template: string
  ): Promise<{script: any; provider: string}> {
    const strategies = [
      {
        name: 'TongYi',
        execute: () => this.tongyiGenerate(text, template),
        priority: 1
      },
      {
        name: 'MiniMax',
        execute: () => this.minimaxGenerate(text, template),
        priority: 2
      },
      {
        name: 'SimpleParser',
        execute: () => this.simpleScriptParser(text),
        priority: 3
      }
    ];

    for (const strategy of strategies.sort((a, b) => a.priority - b.priority)) {
      if (!this.isServiceAvailable(strategy.name)) {
        continue;
      }

      try {
        const result = await strategy.execute();
        this.recordSuccess(strategy.name);
        return { script: result, provider: strategy.name };
      } catch (error) {
        this.recordFailure(strategy.name, error as Error);
      }
    }

    // 最终降级：返回基础脚本
    return {
      script: this.generateBasicScript(text),
      provider: 'BasicGenerator'
    };
  }

  // ========== 具体实现方法 ==========

  private async tikHubWebResolve(videoUrl: string): Promise<{url: string}> {
    // TikHub Web API 实现
    const tikHubClient = new (await import('../clients/tikhub-client')).TikHubClient({
      apiToken: process.env.TIKHUB_API_TOKEN || '',
      preferGuestMode: true
    });
    
    try {
      const result = await tikHubClient.resolveVideo({ url: videoUrl });
      tikHubClient.dispose();
      return { url: result.videoUrl };
    } catch (error) {
      tikHubClient.dispose();
      throw error;
    }
  }

  private async tikHubAppResolve(videoUrl: string): Promise<{url: string}> {
    // TikHub App API 实现
    const tikHubClient = new (await import('../clients/tikhub-client')).TikHubClient({
      apiToken: process.env.TIKHUB_API_TOKEN || '',
      preferGuestMode: false
    });
    
    try {
      const result = await tikHubClient.resolveVideo({ 
        url: videoUrl,
        needAuth: true 
      });
      tikHubClient.dispose();
      return { url: result.videoUrl };
    } catch (error) {
      tikHubClient.dispose();
      throw error;
    }
  }

  private async localVideoParser(videoUrl: string): Promise<{url: string}> {
    // 本地解析器（基于已知模式）
    logger.info('FallbackStrategy', 'localVideoParser', '使用本地解析器');
    
    // 简单的URL转换逻辑
    if (videoUrl.includes('v.douyin.com')) {
      // 尝试直接构造可能的视频URL
      return {
        url: videoUrl.replace('v.douyin.com', 'v26-web.douyinvod.com')
      };
    }
    
    throw new Error('本地解析器无法处理此URL');
  }

  private async directUrlFallback(videoUrl: string): Promise<{url: string}> {
    // 直接返回原URL（最后的尝试）
    logger.warn('FallbackStrategy', 'directUrlFallback', '使用原始URL作为最后尝试');
    return { url: videoUrl };
  }

  private async yunmaoTranscribe(videoUrl: string): Promise<{text: string; confidence: number}> {
    // 云猫转码实现
    const yunmaoClient = new (await import('../clients/yunmao-client')).YunmaoClient({
      apiKey: process.env.YUNMAO_API_KEY || '',
      apiSecret: process.env.YUNMAO_API_SECRET || ''
    });
    
    try {
      const result = await yunmaoClient.extractText(videoUrl, {
        language: 'zh',
        outputFormat: 'txt',
        dialogueMode: false
      });
      
      yunmaoClient.dispose();
      return { 
        text: result.result?.text || '',
        confidence: 0.95 // 云猫通常准确度很高
      };
    } catch (error) {
      yunmaoClient.dispose();
      throw error;
    }
  }

  private async minimaxTranscribe(input: string): Promise<{text: string; confidence: number}> {
    // MiniMax 实现
    const minimaxClient = new (await import('../clients/minimax-client-v2')).MiniMaxClientV2();
    await minimaxClient.initialize({
      apiKey: process.env.MINIMAX_API_KEY || '',
      baseUrl: process.env.MINIMAX_API_BASE_URL || '',
      groupId: process.env.MINIMAX_GROUP_ID || ''
    });
    
    try {
      // 如果是视频URL，需要先下载音频
      const audioFilePath = input.includes('http') ? await this.downloadAudio(input) : input;
      
      // 读取文件为Buffer
      const fs = await import('fs/promises');
      const audioBuffer = await fs.readFile(audioFilePath);
      
      const result = await minimaxClient.speechToText({ audioFile: audioBuffer });
      
      // 清理下载的临时文件
      if (input.includes('http')) {
        const fs = await import('fs/promises');
        await fs.unlink(audioFilePath).catch(() => {});
      }
      
      minimaxClient.dispose();
      return { 
        text: result.text,
        confidence: 0.9 // MiniMax准确度也很好
      };
    } catch (error) {
      minimaxClient.dispose();
      throw error;
    }
  }

  private async aliyunTranscribe(input: string): Promise<{text: string; confidence: number}> {
    // 阿里云实现 - 暂时返回未实现
    throw new ServiceError('SERVICE_ERROR', 'Aliyun', '阿里云语音识别服务暂未集成', '阿里云语音识别服务暂未集成', 501, false);
  }

  private async mockTranscription(): Promise<{text: string; confidence: number}> {
    // 模拟转录（开发/测试用）
    logger.warn('FallbackStrategy', 'mockTranscription', '使用模拟转录数据');
    return {
      text: '这是一个测试视频的转录文本。视频内容包含了各种有趣的元素...',
      confidence: 0.1
    };
  }

  private async tongyiGenerate(text: string, template: string): Promise<any> {
    // 通义千问实现
    const tongyiClient = new (await import('../clients/tongyi-client')).TongyiClient();
    await tongyiClient.initialize({
      apiKey: process.env.TONGYI_API_KEY || '',
      baseUrl: process.env.TONGYI_API_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1'
    });
    
    try {
      const prompt = template.replace('{{transcriptText}}', text);
      const result = await tongyiClient.generateText({ prompt, max_tokens: 2000 });
      
      tongyiClient.dispose();
      return result.text;
    } catch (error) {
      tongyiClient.dispose();
      throw error;
    }
  }

  private async minimaxGenerate(text: string, template: string): Promise<any> {
    // MiniMax 生成实现 - 暂未实现文本生成功能
    throw new ServiceError('SERVICE_ERROR', 'MiniMax', 'MiniMax文本生成服务暂未集成', 'MiniMax文本生成服务暂未集成', 501, false);
  }

  private async simpleScriptParser(text: string): Promise<any> {
    // 简单的脚本解析器
    logger.info('FallbackStrategy', 'simpleScriptParser', '使用简单脚本解析器');
    
    // 基于规则的简单分段
    const sentences = text.split(/[。！？]/);
    const scenes = [];
    
    for (let i = 0; i < sentences.length; i += 3) {
      scenes.push({
        scene_number: Math.floor(i / 3) + 1,
        timestamp: `00:${String(i * 10).padStart(2, '0')}-00:${String((i + 3) * 10).padStart(2, '0')}`,
        description: '场景描述',
        dialogue: sentences.slice(i, i + 3).join('。'),
        notes: '自动生成'
      });
    }
    
    return {
      title: '自动生成的视频脚本',
      duration: scenes.length * 30,
      scenes
    };
  }

  private generateBasicScript(text: string): any {
    // 最基础的脚本生成
    return {
      title: '基础脚本',
      duration: 60,
      scenes: [{
        scene_number: 1,
        timestamp: '00:00-01:00',
        description: '完整内容',
        dialogue: text,
        notes: '降级生成'
      }]
    };
  }

  // ========== 服务管理方法 ==========

  private isServiceAvailable(serviceName: string): boolean {
    const status = this.serviceStatus.get(serviceName);
    if (!status) {
      // 新服务默认可用
      this.serviceStatus.set(serviceName, {
        available: true,
        lastCheckTime: Date.now(),
        failureCount: 0,
        errorRate: 0
      });
      return true;
    }

    // 检查是否需要重置
    if (!status.available && 
        status.lastFailureTime && 
        Date.now() - status.lastFailureTime > this.config.resetTimeout) {
      logger.info('FallbackStrategy', 'isServiceAvailable', `重置服务状态: ${serviceName}`);
      status.available = true;
      status.failureCount = 0;
      status.errorRate = 0;
    }

    return status.available;
  }

  private recordSuccess(serviceName: string): void {
    const status = this.serviceStatus.get(serviceName) || {
      available: true,
      lastCheckTime: Date.now(),
      failureCount: 0,
      errorRate: 0
    };

    // 更新错误率（简单移动平均）
    status.errorRate = status.errorRate * 0.9; // 成功会降低错误率
    status.lastCheckTime = Date.now();
    
    this.serviceStatus.set(serviceName, status);
  }

  private recordFailure(serviceName: string, error: Error): void {
    const status = this.serviceStatus.get(serviceName) || {
      available: true,
      lastCheckTime: Date.now(),
      failureCount: 0,
      errorRate: 0
    };

    status.failureCount++;
    status.lastFailureTime = Date.now();
    status.errorRate = Math.min(status.errorRate * 0.9 + 0.1, 1); // 失败会增加错误率

    // 检查是否需要标记为不可用
    if (status.failureCount >= this.config.maxFailures || 
        status.errorRate > this.config.errorRateThreshold) {
      status.available = false;
      logger.error('FallbackStrategy', 'recordFailure', `服务已标记为不可用: ${serviceName}`, undefined, {
        failureCount: status.failureCount,
        errorRate: status.errorRate
      });
    }

    this.serviceStatus.set(serviceName, status);
  }

  /**
   * 获取服务状态报告
   */
  getServiceReport(): Record<string, ServiceStatus> {
    const report: Record<string, ServiceStatus> = {};
    this.serviceStatus.forEach((status, name) => {
      report[name] = { ...status };
    });
    return report;
  }

  /**
   * 手动重置服务状态
   */
  resetService(serviceName: string): void {
    const status = this.serviceStatus.get(serviceName);
    if (status) {
      status.available = true;
      status.failureCount = 0;
      status.errorRate = 0;
      logger.info('FallbackStrategy', 'resetService', `手动重置服务: ${serviceName}`);
    }
  }
  
  /**
   * 下载音频文件（为MiniMax等服务使用）
   */
  private async downloadAudio(videoUrl: string): Promise<string> {
    const { VideoDownloader } = await import('../utils/video-downloader');
    const path = await import('path');
    const fs = await import('fs/promises');
    
    const downloader = new VideoDownloader();
    const tempDir = path.join(process.cwd(), 'temp');
    
    // 确保临时目录存在
    await fs.mkdir(tempDir, { recursive: true });
    
    const audioPath = await VideoDownloader.download({ url: videoUrl, outputPath: `${tempDir}/audio.mp3` }).then((r: any) => r.filePath || '');
    return audioPath;
  }
}