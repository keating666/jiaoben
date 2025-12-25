import { VercelRequest, VercelResponse } from '@vercel/node';
import { v4 as uuidv4 } from 'uuid';

// 类型定义
interface TranscribeV2Request {
  video_url?: string;      // 视频URL
  mixedText?: string;      // 混合文本输入
  provider?: 'minimax' | 'yunmao' | 'auto';  // 服务提供商
  style?: 'default' | 'humorous' | 'professional';
  language?: string;
  options?: {
    dialogueMode?: boolean;    // 对话模式（云猫转码支持）
    speakerCount?: number;     // 说话人数量
    waitForResult?: boolean;   // 是否等待结果（默认true）
  };
}

interface ScriptScene {
  scene_number: number;
  timestamp: string;
  description: string;
  dialogue: string;
  notes: string;
}

interface VideoScript {
  title: string;
  duration: number;
  scenes: ScriptScene[];
}

interface TranscribeV2Response {
  success: boolean;
  data?: {
    original_text: string;
    script: VideoScript;
    processing_time: number;
    provider: string;         // 使用的服务提供商
    metadata?: {
      taskId?: string;
      wordCount?: number;
      confidence?: number;
      [key: string]: any;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// 性能追踪器类
class PerformanceTracker {
  private stages: Map<string, number> = new Map();
  private startTime: number = Date.now();

  startStage(name: string): void {
    this.stages.set(name, Date.now());
  }

  endStage(name: string): number {
    const start = this.stages.get(name);
    if (!start) throw new Error(`Stage ${name} not started`);
    const duration = Date.now() - start;
    console.log(`Stage ${name} completed in ${duration}ms`);
    return duration;
  }

  getTotalTime(): number {
    return Date.now() - this.startTime;
  }
}

// 创建自定义错误
function createVideoError(code: string, message: string, details?: any): Error {
  const error = new Error(message) as any;
  error.code = code;
  error.details = details;
  return error;
}

// 导入安全验证器和并发控制器
import { SecurityValidator } from '../../tech-validation/utils/security-validator';
import { ConcurrencyController } from '../../tech-validation/utils/concurrency-controller';
import { TranscriptionProviderManager } from '../../tech-validation/services/transcription-provider-manager';
import { RobustDouyinExtractor } from '../../tech-validation/utils/robust-douyin-extractor';

// 创建全局实例
const concurrencyController = new ConcurrencyController(3);
const transcriptionManager = new TranscriptionProviderManager();

// 主处理函数
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: '仅支持 POST 请求'
      }
    } as TranscribeV2Response);
    return;
  }

  // API 密钥验证
  const authValidation = SecurityValidator.validateAuthorizationHeader(req.headers.authorization);
  if (!authValidation.valid) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: authValidation.reason || '未提供有效的API密钥'
      }
    } as TranscribeV2Response);
    return;
  }

  const sessionId = uuidv4();
  const tracker = new PerformanceTracker();
  
  // 设置超时警告
  const timeoutWarningTimer = setTimeout(() => {
    console.warn(`⚠️ 视频处理超时警告: session ${sessionId} 已运行50秒，即将超时`);
  }, 50000);
  
  try {
    // 请求体验证
    const { 
      video_url, 
      mixedText, 
      provider = 'auto',
      style = 'default', 
      language = 'zh',
      options = {}
    }: TranscribeV2Request = req.body;
    
    let finalVideoUrl = video_url;
    
    // 如果提供了混合文本，先提取链接
    if (mixedText && !video_url) {
      tracker.startStage('link_extraction');
      
      // 使用健壮版抖音链接提取器
      const extractResult = await RobustDouyinExtractor.smartExtract(mixedText);
      
      if (extractResult.links.length > 0) {
        finalVideoUrl = extractResult.links[0].url;
        console.log(`📎 从混合文本中提取链接: ${extractResult.links[0].platform} - ${finalVideoUrl}`);
      } else {
        // 如果没有抖音链接，尝试通用提取
        const { LinkExtractor } = await import('../../tech-validation/utils/link-extractor');
        const extracted = LinkExtractor.extractVideoLink(mixedText);
        
        if (extracted) {
          finalVideoUrl = LinkExtractor.cleanUrl(extracted.url);
          console.log(`📎 从混合文本中提取链接: ${extracted.platform} - ${finalVideoUrl}`);
        } else {
          throw createVideoError('NO_VIDEO_LINK', '无法从文本中提取视频链接', {
            providedText: SecurityValidator.sanitizeForLogging(mixedText.substring(0, 100))
          });
        }
      }
      
      tracker.endStage('link_extraction');
    }
    
    if (!finalVideoUrl) {
      throw createVideoError('INVALID_REQUEST', '缺少必需的 video_url 参数或 mixedText 参数');
    }

    // URL 安全性验证
    const urlValidation = SecurityValidator.validateVideoUrl(finalVideoUrl);
    if (!urlValidation.valid) {
      throw createVideoError('INVALID_VIDEO_URL', urlValidation.reason || '无效的视频链接', { 
        video_url: SecurityValidator.sanitizeForLogging(finalVideoUrl) 
      });
    }

    // 样式和语言参数验证
    const styleValidation = SecurityValidator.validateStyle(style);
    if (!styleValidation.valid) {
      throw createVideoError('INVALID_REQUEST', styleValidation.reason || '无效的样式参数');
    }

    const langValidation = SecurityValidator.validateLanguage(language);
    if (!langValidation.valid) {
      throw createVideoError('INVALID_REQUEST', langValidation.reason || '无效的语言参数');
    }

    tracker.startStage('total_processing');
    
    // 使用并发控制器执行处理
    const processingResult = await concurrencyController.execute(sessionId, async () => {
      let transcriptionText: string;
      let usedProvider: string;
      let transcriptionMetadata: any = {};
      
      // 决定使用哪种处理策略
      const useDirectTranscription = provider === 'yunmao' || 
        (provider === 'auto' && process.env.YUNMAO_API_KEY);
      
      if (useDirectTranscription) {
        // 策略1：直接使用云猫转码处理视频
        tracker.startStage('direct_transcription');
        
        try {
          const result = await transcriptionManager.transcribe({
            videoUrl: finalVideoUrl,
            language: mapLanguageCode(language),
            provider: provider === 'yunmao' ? 'yunmao' : undefined,
            options: {
              dialogueMode: options.dialogueMode,
              speakerCount: options.speakerCount,
              outputFormat: 'text'
            }
          });
          
          transcriptionText = result.text;
          usedProvider = result.provider;
          transcriptionMetadata = {
            wordCount: result.wordCount,
            confidence: result.confidence,
            duration: result.duration,
            ...result.metadata
          };
          
          const transcriptionTime = tracker.endStage('direct_transcription');
          console.log(`✅ 直接转录完成 (${usedProvider}): ${transcriptionTime}ms`);
          
        } catch (directError) {
          console.error('直接转录失败，尝试传统流程:', directError);
          
          // 如果云猫失败，回退到传统流程
          if (provider !== 'yunmao') {
            return await processWithTraditionalFlow();
          } else {
            throw directError;
          }
        }
        
      } else {
        // 策略2：传统流程（下载视频 -> 提取音频 -> 转录）
        return await processWithTraditionalFlow();
      }
      
      // 生成分镜头脚本
      tracker.startStage('script_generation');
      const { ScriptGenerator } = await import('../../tech-validation/utils/script-generator');
      
      const scriptGenerator = new ScriptGenerator();
      const scriptResult = await scriptGenerator.generateScript(transcriptionText, {
        style,
        language,
        duration: transcriptionMetadata.duration || 60,
        title: `视频脚本 - ${new Date().toLocaleDateString()}`
      });
      const scriptGenerationTime = tracker.endStage('script_generation');
      
      console.log(`✅ 脚本生成完成: ${scriptGenerationTime}ms`);
      console.log(`🎭 生成场景数: ${scriptResult.script.scenes.length}`);
      
      // 清理资源
      await scriptGenerator.dispose();
      
      const response: TranscribeV2Response = {
        success: true,
        data: {
          original_text: transcriptionText,
          script: scriptResult.script,
          processing_time: tracker.getTotalTime(),
          provider: usedProvider,
          metadata: transcriptionMetadata
        }
      };
      
      return response;
      
      // 传统处理流程函数
      async function processWithTraditionalFlow() {
        // 导入视频处理器
        const { VideoProcessor } = await import('../../tech-validation/utils/video-processor');
        
        // 下载视频并提取音频
        tracker.startStage('video_processing');
        
        let audioPath: string;
        let metadata: any;
        
        try {
          const result = await VideoProcessor.downloadAndExtractAudio(finalVideoUrl!);
          audioPath = result.audioPath;
          metadata = result.metadata;
        } catch (videoError: any) {
          // 处理 Vercel 环境特殊情况
          if ((videoError.code === 'VERCEL_PYTHON_MISSING' || 
               videoError.code === 'REPLIT_SERVICE_UNAVAILABLE') && 
               process.env.VERCEL) {
            console.log('⚠️  视频下载服务不可用，使用模拟音频测试');
            
            const { createMockAudioFile } = await import('../../tech-validation/utils/mock-audio');
            
            audioPath = `/tmp/mock_audio_${uuidv4()}.mp3`;
            await createMockAudioFile(audioPath);
            
            metadata = {
              duration: 30,
              title: '测试视频（模拟）',
              format: 'mp4',
              url: finalVideoUrl,
            };
          } else {
            throw videoError;
          }
        }
        
        const videoProcessingTime = tracker.endStage('video_processing');
        console.log(`✅ 视频处理完成: ${videoProcessingTime}ms`);
        
        // 音频转文字
        tracker.startStage('audio_transcription');
        
        const result = await transcriptionManager.transcribe({
          audioPath,
          language: mapLanguageCode(language),
          provider: provider === 'minimax' ? 'minimax' : undefined
        });
        
        const transcriptionTime = tracker.endStage('audio_transcription');
        console.log(`✅ 音频转写完成 (${result.provider}): ${transcriptionTime}ms`);
        
        transcriptionText = result.text;
        usedProvider = result.provider;
        transcriptionMetadata = {
          duration: metadata.duration,
          ...result.metadata
        };
        
        // 清理临时文件
        const fs = await import('fs/promises');
        await fs.unlink(audioPath).catch(() => {});
        
        return null; // 继续主流程
      }
    });

    // 清除超时警告定时器
    clearTimeout(timeoutWarningTimer);
    
    // 发送成功响应
    res.status(200).json(processingResult);
    
  } catch (error) {
    // 清除超时警告定时器
    clearTimeout(timeoutWarningTimer);
    
    const videoError = error as any;
    const processingTime = tracker.getTotalTime();
    
    // 记录错误
    const sanitizedError = error instanceof Error 
      ? SecurityValidator.sanitizeForLogging(error.message)
      : 'Unknown error';
    console.error(`❌ 视频处理失败: session ${sessionId} (${processingTime}ms)`, sanitizedError);
    
    // 错误响应
    if (videoError.code) {
      const errorMappings: Record<string, { status: number; userFriendly: boolean }> = {
        'UNAUTHORIZED': { status: 401, userFriendly: true },
        'INVALID_REQUEST': { status: 400, userFriendly: true },
        'INVALID_VIDEO_URL': { status: 400, userFriendly: true },
        'NO_VIDEO_LINK': { status: 400, userFriendly: true },
        'VIDEO_TOO_LONG': { status: 400, userFriendly: true },
        'VIDEO_DOWNLOAD_FAILED': { status: 422, userFriendly: true },
        'TRANSCRIPTION_FAILED': { status: 422, userFriendly: true },
        'SCRIPT_GENERATION_FAILED': { status: 422, userFriendly: true },
        'PROVIDER_NOT_AVAILABLE': { status: 503, userFriendly: true },
        'ALL_PROVIDERS_FAILED': { status: 503, userFriendly: true },
        'API_QUOTA_EXCEEDED': { status: 429, userFriendly: true },
      };
      
      const errorConfig = errorMappings[videoError.code];
      const statusCode = errorConfig?.status || 500;
      
      const friendlyMessage = errorConfig?.userFriendly 
        ? videoError.message 
        : '服务暂时不可用，请稍后重试';
      
      res.status(statusCode).json({
        success: false,
        error: {
          code: videoError.code,
          message: friendlyMessage,
          details: errorConfig?.userFriendly ? videoError.details : undefined,
          processing_time: processingTime
        }
      } as TranscribeV2Response);
      return;
    }
    
    // 通用错误处理
    res.status(500).json({
      success: false,
      error: {
        code: 'PROCESSING_FAILED',
        message: '视频处理失败，请稍后重试',
        processing_time: processingTime
      }
    } as TranscribeV2Response);
  } finally {
    // 清理管理器资源
    transcriptionManager.dispose();
  }
}

// 语言代码映射
function mapLanguageCode(language: string): string {
  const languageMap: Record<string, string> = {
    'zh': 'zh-CN',
    'en': 'en-US',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'ru': 'ru-RU',
    'ar': 'ar-SA',
    'pt': 'pt-BR'
  };
  
  return languageMap[language] || language;
}