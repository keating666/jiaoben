import { VercelRequest, VercelResponse } from '@vercel/node';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// 类型定义
interface TranscribeRequest {
  video_url?: string;  // 现在是可选的
  mixedText?: string;  // 新增：支持混合文本输入
  style?: 'default' | 'humorous' | 'professional';
  language?: string;
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

interface TranscribeResponse {
  success: boolean;
  data?: {
    original_text: string;
    script: VideoScript;
    processing_time: number;
    _metadata?: {
      usingMockAudio: boolean;
      reason: string;
      note: string;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface VideoProcessingError extends Error {
  code: string;
  details?: any;
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

// 临时文件清理函数
async function cleanup(sessionId: string): Promise<void> {
  const tempDir = '/tmp';
  const videoPath = path.join(tempDir, `${sessionId}.mp4`);
  const audioPath = path.join(tempDir, `${sessionId}.mp3`);
  
  try {
    await fs.unlink(videoPath).catch(() => {}); // 忽略文件不存在的错误
    await fs.unlink(audioPath).catch(() => {}); // 忽略文件不存在的错误
    console.log(`Cleanup completed for session ${sessionId}`);
  } catch (error) {
    console.error('临时文件清理失败:', error);
  }
}

// 重试包装器
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// 创建自定义错误
function createVideoError(code: string, message: string, details?: any): VideoProcessingError {
  const error = new Error(message) as VideoProcessingError;
  error.code = code;
  error.details = details;
  return error;
}

// 导入安全验证器
import { SecurityValidator } from '../../tech-validation/utils/security-validator';
import { ConcurrencyController } from '../../tech-validation/utils/concurrency-controller';

// 创建全局并发控制器（限制 3 个并发请求）
const concurrencyController = new ConcurrencyController(3);

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
    } as TranscribeResponse);
    return;
  }

  // API 密钥验证（使用安全验证器）
  const authValidation = SecurityValidator.validateAuthorizationHeader(req.headers.authorization);
  if (!authValidation.valid) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: authValidation.reason || '未提供有效的API密钥'
      }
    } as TranscribeResponse);
    return;
  }

  const sessionId = uuidv4();
  const tracker = new PerformanceTracker();
  
  // 设置超时警告（50秒警告，60秒是 Vercel 函数限制）
  const timeoutWarningTimer = setTimeout(() => {
    console.warn(`⚠️ 视频处理超时警告: session ${sessionId} 已运行50秒，即将超时`);
  }, 50000);
  
  try {
    // 请求体验证
    let { video_url, mixedText, style = 'default', language = 'zh' }: TranscribeRequest = req.body;
    
    // 如果提供了混合文本，先提取链接
    if (mixedText && !video_url) {
      // 首先尝试使用专门的抖音链接提取器
      const { DouyinLinkExtractor } = await import('../../tech-validation/utils/douyin-link-extractor');
      let extracted = DouyinLinkExtractor.extractDouyinLink(mixedText);
      
      // 如果不是抖音链接，使用通用链接提取器
      if (!extracted) {
        const { LinkExtractor } = await import('../../tech-validation/utils/link-extractor');
        extracted = LinkExtractor.extractVideoLink(mixedText);
      }
      
      // 如果正则提取失败，尝试使用 AI
      if (!extracted) {
        console.log('正则提取失败，尝试使用 AI 提取链接...');
        const { AILinkExtractor } = await import('../../tech-validation/utils/ai-link-extractor');
        const aiExtractor = new AILinkExtractor();
        
        try {
          extracted = await aiExtractor.extractVideoLink(mixedText);
          await aiExtractor.dispose();
        } catch (aiError) {
          console.error('AI 提取链接失败:', aiError);
        }
      }
      
      if (!extracted) {
        throw createVideoError('NO_VIDEO_LINK', '无法从文本中提取视频链接', {
          providedText: SecurityValidator.sanitizeForLogging(mixedText.substring(0, 100))
        });
      }
      
      // 使用相应的清理方法
      if (extracted.platform === 'douyin') {
        video_url = DouyinLinkExtractor.normalizeUrl(extracted.url);
      } else {
        const { LinkExtractor } = await import('../../tech-validation/utils/link-extractor');
        video_url = LinkExtractor.cleanUrl(extracted.url);
      }
      console.log(`📎 从混合文本中提取链接: ${extracted.platform} - ${video_url}`);
    }
    
    if (!video_url) {
      throw createVideoError('INVALID_REQUEST', '缺少必需的 video_url 参数或 mixedText 参数');
    }

    // URL 安全性验证（使用安全验证器）
    const urlValidation = SecurityValidator.validateVideoUrl(video_url);
    if (!urlValidation.valid) {
      throw createVideoError('INVALID_VIDEO_URL', urlValidation.reason || '无效的视频链接', { 
        video_url: SecurityValidator.sanitizeForLogging(video_url) 
      });
    }

    // 样式参数验证
    const styleValidation = SecurityValidator.validateStyle(style);
    if (!styleValidation.valid) {
      throw createVideoError('INVALID_REQUEST', styleValidation.reason || '无效的样式参数');
    }

    // 语言参数验证
    const langValidation = SecurityValidator.validateLanguage(language);
    if (!langValidation.valid) {
      throw createVideoError('INVALID_REQUEST', langValidation.reason || '无效的语言参数');
    }

    tracker.startStage('total_processing');
    
    // 使用并发控制器执行处理
    const processingResult = await concurrencyController.execute(sessionId, async () => {
      // 导入视频处理器（使用动态导入避免路径问题）
      const { VideoProcessor } = await import('../../tech-validation/utils/video-processor');
      
      try {
      // 第一阶段：处理视频（下载 + 提取音频）
      tracker.startStage('video_processing');
      
      let audioPath: string;
      let metadata: any;
      let isUsingMockData = false;
      
      try {
        const result = await VideoProcessor.downloadAndExtractAudio(video_url);
        audioPath = result.audioPath;
        metadata = result.metadata;
      } catch (videoError: any) {
        // 检查是否是 Vercel Python 缺失错误或 Replit 服务不可用
        if ((videoError.code === 'VERCEL_PYTHON_MISSING' || videoError.code === 'REPLIT_SERVICE_UNAVAILABLE') && process.env.VERCEL) {
          console.log('⚠️  视频下载服务不可用，使用模拟音频测试 AI 功能');
          
          // 使用模拟数据
          const { createMockAudioFile, MOCK_TRANSCRIPT } = await import('../../tech-validation/utils/mock-audio');
          const { v4: uuidv4 } = await import('uuid');
          
          audioPath = `/tmp/mock_audio_${uuidv4()}.mp3`;
          await createMockAudioFile(audioPath);
          
          metadata = {
            duration: 30,
            title: '测试视频（Vercel 模拟）',
            format: 'mp4',
            url: video_url,
          };
          
          isUsingMockData = true;
          console.log('✅ 创建模拟音频文件成功，将使用真实 API 进行转写');
        } else {
          // 其他错误正常抛出
          throw videoError;
        }
      }
      
      const videoProcessingTime = tracker.endStage('video_processing');
      
      console.log(`✅ 视频处理完成: ${videoProcessingTime}ms${isUsingMockData ? ' (使用模拟音频)' : ''}`);
      
      // 第二阶段：音频转文字
      tracker.startStage('audio_transcription');
      const { AudioTranscriber } = await import('../../tech-validation/utils/audio-transcriber');
      
      const transcriber = new AudioTranscriber();
      const transcriptionResult = await transcriber.transcribeAudioFile(audioPath);
      const transcriptionTime = tracker.endStage('audio_transcription');
      
      console.log(`✅ 音频转写完成: ${transcriptionTime}ms`);
      console.log(`📝 转写结果: ${transcriptionResult.text.substring(0, 100)}...`);
      
      // 清理转写器资源
      await transcriber.dispose();
      
      // 第三阶段：生成分镜头脚本
      tracker.startStage('script_generation');
      const { ScriptGenerator } = await import('../../tech-validation/utils/script-generator');
      
      const scriptGenerator = new ScriptGenerator();
      const scriptResult = await scriptGenerator.generateScript(transcriptionResult.text, {
        style,
        language,
        duration: metadata.duration,
        title: metadata.title
      });
      const scriptGenerationTime = tracker.endStage('script_generation');
      
      console.log(`✅ 脚本生成完成: ${scriptGenerationTime}ms`);
      console.log(`🎭 生成场景数: ${scriptResult.script.scenes.length}`);
      
      // 清理脚本生成器资源
      await scriptGenerator.dispose();
      
      const response: TranscribeResponse = {
        success: true,
        data: {
          original_text: transcriptionResult.text,
          script: scriptResult.script,
          processing_time: tracker.getTotalTime(),
          // 添加元数据标记
          ...(isUsingMockData && {
            _metadata: {
              usingMockAudio: true,
              reason: 'Vercel 环境缺少 Python 运行时',
              note: 'API 调用使用真实服务，仅音频文件为模拟'
            }
          })
        }
      };

      // 清除超时警告定时器
      clearTimeout(timeoutWarningTimer);
      
      await cleanup(sessionId);
      
      // 记录性能指标
      console.log(`📊 处理完成统计: session ${sessionId}`);
      console.log(`  - 视频处理: ${videoProcessingTime}ms`);  
      console.log(`  - 音频转写: ${transcriptionTime}ms`);
      console.log(`  - 脚本生成: ${scriptGenerationTime}ms`);
      console.log(`  - 总耗时: ${tracker.getTotalTime()}ms`);
      console.log(`  - 转写质量: ${(transcriptionResult.confidence * 100).toFixed(1)}%`);
      console.log(`  - 场景数量: ${scriptResult.script.scenes.length}`);
      
        return response; // 返回响应给并发控制器
        
      } catch (processingError) {
        console.error('视频处理阶段失败:', processingError);
        throw processingError; // 重新抛出错误，由外层错误处理捕获
      }
    });

    // 清除超时警告定时器
    clearTimeout(timeoutWarningTimer);
    
    // 发送成功响应
    res.status(200).json(processingResult);
    return;

  } catch (error) {
    // 清除超时警告定时器
    clearTimeout(timeoutWarningTimer);
    
    await cleanup(sessionId);
    
    const videoError = error as VideoProcessingError;
    const processingTime = tracker.getTotalTime();
    
    // 记录错误和性能指标（清理敏感信息）
    const sanitizedError = error instanceof Error 
      ? SecurityValidator.sanitizeForLogging(error.message)
      : 'Unknown error';
    console.error(`❌ 视频处理失败: session ${sessionId} (${processingTime}ms)`, sanitizedError);
    
    // 超时检测
    if (processingTime > 55000) {
      console.error(`⏰ 处理超时: ${processingTime}ms > 55s, 可能导致 Vercel Functions 超时`);
    }
    
    // 扩展的错误处理
    if (videoError.code) {
      const errorMappings = {
        'UNAUTHORIZED': { status: 401, userFriendly: true },
        'INVALID_REQUEST': { status: 400, userFriendly: true },
        'INVALID_VIDEO_URL': { status: 400, userFriendly: true },
        'NO_VIDEO_LINK': { status: 400, userFriendly: true },
        'VIDEO_TOO_LONG': { status: 400, userFriendly: true },
        'VIDEO_DOWNLOAD_FAILED': { status: 422, userFriendly: true },
        'AUDIO_EXTRACTION_FAILED': { status: 422, userFriendly: true },
        'TRANSCRIPTION_FAILED': { status: 422, userFriendly: true },
        'SCRIPT_GENERATION_FAILED': { status: 422, userFriendly: true },
        'UNSUPPORTED_FORMAT': { status: 415, userFriendly: true },
        'FILE_TOO_LARGE': { status: 413, userFriendly: true },
        'NETWORK_ERROR': { status: 502, userFriendly: true },
        'API_QUOTA_EXCEEDED': { status: 429, userFriendly: true },
        'INVALID_API_KEY': { status: 502, userFriendly: false }, // 不暴露内部配置错误
      };
      
      const errorConfig = errorMappings[videoError.code as keyof typeof errorMappings];
      const statusCode = errorConfig?.status || 500;
      
      // 用户友好的错误消息
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
      } as TranscribeResponse);
      return;
    }
    
    // 未知错误的通用处理
    const errorMessage = error instanceof Error ? error.message : String(error);
    let generalErrorCode = 'PROCESSING_FAILED';
    let generalErrorMessage = '视频处理失败，请稍后重试';
    
    // 检测常见的系统级错误
    if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
      generalErrorCode = 'PROCESSING_TIMEOUT';
      generalErrorMessage = '处理超时，请尝试更短的视频或稍后重试';
    } else if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
      generalErrorCode = 'NETWORK_ERROR';
      generalErrorMessage = '网络连接错误，请检查网络后重试';
    } else if (errorMessage.includes('memory') || errorMessage.includes('ENOMEM')) {
      generalErrorCode = 'RESOURCE_EXHAUSTED';
      generalErrorMessage = '系统资源不足，请稍后重试';
    }
    
    res.status(500).json({
      success: false,
      error: {
        code: generalErrorCode,
        message: generalErrorMessage,
        processing_time: processingTime
      }
    } as TranscribeResponse);
    return;
  }
}