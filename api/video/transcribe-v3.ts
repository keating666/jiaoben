import { VercelRequest, VercelResponse } from '@vercel/node';
import { monitoring } from '../../tech-validation/utils/monitoring';
import { ErrorHandler, ValidationError, ServiceError } from '../../tech-validation/utils/error-types';
import { FallbackStrategyManager } from '../../tech-validation/services/fallback-strategy';
import { RobustDouyinExtractor } from '../../tech-validation/utils/robust-douyin-extractor';
import { PromptTemplateManager } from '../../tech-validation/services/prompt-template-manager';
import { SecurityValidator } from '../../tech-validation/utils/security-validator';
import { ConcurrencyController } from '../../tech-validation/utils/concurrency-controller';

// 创建全局实例
const fallbackManager = new FallbackStrategyManager({
  maxFailures: parseInt(process.env.FALLBACK_MAX_FAILURES || '3'),
  resetTimeout: parseInt(process.env.FALLBACK_RESET_TIMEOUT || '60000'),
  errorRateThreshold: parseFloat(process.env.FALLBACK_ERROR_THRESHOLD || '0.5')
});

const promptManager = new PromptTemplateManager();
const concurrencyController = new ConcurrencyController(3);
const securityValidator = new SecurityValidator();

// 请求类型定义
interface TranscribeV3Request {
  mixedText?: string;
  videoUrl?: string;
  style?: 'default' | 'humorous' | 'professional';
  language?: string;
  templateId?: string;
}

interface TranscribeV3Response {
  success: boolean;
  data?: {
    originalText: string;
    script: any;
    processingTime: number;
    provider: {
      videoResolver?: string;
      transcription?: string;
      scriptGenerator?: string;
    };
  };
  error?: {
    code: string;
    message: string;
    userMessage: string;
    retryable: boolean;
  };
}

// 输入验证
async function validateInput(req: VercelRequest): Promise<TranscribeV3Request> {
  const monitor = monitoring.startSpan('input_validation');
  
  try {
    const body = req.body as TranscribeV3Request;
    
    if (!body.mixedText && !body.videoUrl) {
      throw new ValidationError('必须提供 mixedText 或 videoUrl', 'input');
    }
    
    // 验证 style
    if (body.style && !['default', 'humorous', 'professional'].includes(body.style)) {
      throw new ValidationError('无效的 style 参数', 'style', body.style);
    }
    
    monitoring.endSpan(monitor, 'success');
    return body;
  } catch (error) {
    monitoring.endSpan(monitor, 'error', error as Error);
    throw error;
  }
}

// 提取视频 URL
async function extractVideoUrl(input: TranscribeV3Request): Promise<string> {
  const monitor = monitoring.startSpan('extract_video_url');
  
  try {
    if (input.videoUrl) {
      monitoring.endSpan(monitor, 'success');
      return input.videoUrl;
    }
    
    if (input.mixedText) {
      const extractResult = await RobustDouyinExtractor.extract(input.mixedText);
      if (extractResult.links.length === 0) {
        throw new ValidationError('未找到有效的视频链接', 'mixedText');
      }
      
      monitoring.endSpan(monitor, 'success');
      return extractResult.links[0].url;
    }
    
    throw new ValidationError('无法提取视频链接', 'input');
  } catch (error) {
    monitoring.endSpan(monitor, 'error', error as Error);
    throw error;
  }
}

// 生成脚本（使用模板）
async function generateScriptWithTemplate(
  transcript: string, 
  request: TranscribeV3Request
): Promise<{ script: any; provider: string }> {
  const monitor = monitoring.startSpan('generate_script');
  
  try {
    // 选择模板
    const templateId = request.templateId || `${request.style || 'default'}-script`;
    
    // 渲染模板
    const prompt = promptManager.renderTemplate(templateId, {
      transcriptText: transcript,
      style: request.style || 'default',
      language: request.language || 'zh'
    });
    
    // 使用降级策略生成脚本
    const result = await fallbackManager.generateScriptWithFallback(transcript, prompt);
    
    monitoring.endSpan(monitor, 'success');
    return result;
  } catch (error) {
    monitoring.endSpan(monitor, 'error', error as Error);
    throw error;
  }
}

// 主处理函数
export default async function transcribeV3(req: VercelRequest, res: VercelResponse): Promise<void> {
  const monitor = monitoring.startSpan('video.transcribe-v3', {
    method: req.method,
    url: req.url
  });
  
  const startTime = Date.now();
  
  try {
    // 1. 方法验证
    if (req.method !== 'POST') {
      monitoring.recordMetric('api.error.count', 1, { error_type: 'method_not_allowed' });
      res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: '仅支持 POST 请求',
          userMessage: '请求方法不正确',
          retryable: false
        }
      } as TranscribeV3Response);
      return;
    }
    
    // 2. API 密钥验证
    const authValidation = SecurityValidator.validateAuthorizationHeader(req.headers.authorization);
    if (!authValidation.valid) {
      monitoring.recordMetric('api.error.count', 1, { error_type: 'unauthorized' });
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: authValidation.reason || '未提供有效的API密钥',
          userMessage: '认证失败，请检查API密钥',
          retryable: false
        }
      } as TranscribeV3Response);
      return;
    }
    
    // 3. 并发控制
    const processingResult = await concurrencyController.execute(async () => {
      // 3.1 输入验证
      const input = await validateInput(req);
      monitoring.recordMetric('api.request.count', 1, { style: input.style || 'default' });
      
      // 3.2 链接提取
      const videoUrl = await extractVideoUrl(input);
      monitoring.recordMetric('video.url_extracted', 1);
      
      // 3.3 视频解析（带降级）
      const realUrlResult = await fallbackManager.resolveVideoWithFallback(videoUrl);
      monitoring.recordMetric('video.resolved', 1, { source: realUrlResult.source });
      
      // 3.4 音频转文字（带降级）
      const transcriptResult = await fallbackManager.transcribeWithFallback({
        videoUrl: realUrlResult.url
      });
      monitoring.recordMetric('video.transcribed', 1, { 
        provider: transcriptResult.provider,
        confidence: Math.round(transcriptResult.confidence * 100)
      });
      
      // 3.5 脚本生成（带模板）
      const scriptResult = await generateScriptWithTemplate(
        transcriptResult.text,
        input
      );
      monitoring.recordMetric('script.generated', 1, { provider: scriptResult.provider });
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: {
          originalText: transcriptResult.text,
          script: scriptResult.script,
          processingTime,
          provider: {
            videoResolver: realUrlResult.source,
            transcription: transcriptResult.provider,
            scriptGenerator: scriptResult.provider
          }
        }
      } as TranscribeV3Response;
    });
    
    // 成功响应
    monitoring.endSpan(monitor, 'success');
    monitoring.recordMetric('api.success.count', 1);
    monitoring.recordMetric('api.processing_time', processingResult.data?.processingTime || 0);
    
    res.status(200).json(processingResult);
    
  } catch (error) {
    // 错误处理
    monitoring.endSpan(monitor, 'error', error as Error);
    monitoring.recordError(error as Error, {
      endpoint: 'transcribe-v3',
      processingTime: Date.now() - startTime
    });
    
    const userMessage = ErrorHandler.getUserMessage(error as Error);
    const isRetryable = ErrorHandler.isRetryable(error as Error);
    
    // 确定状态码
    let statusCode = 500;
    if (error instanceof ValidationError) statusCode = 400;
    else if (error instanceof ServiceError) statusCode = error.statusCode || 503;
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: (error as any).code || 'PROCESSING_FAILED',
        message: error instanceof Error ? error.message : '处理失败',
        userMessage,
        retryable: isRetryable
      }
    } as TranscribeV3Response);
  }
}

// 导出服务状态报告端点
export async function getServiceStatus(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  const report = fallbackManager.getServiceReport();
  const health = monitoring.getHealthMetrics();
  
  res.status(200).json({
    services: report,
    health,
    timestamp: new Date().toISOString()
  });
}