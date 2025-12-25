import { VercelRequest, VercelResponse } from '@vercel/node';
import { SecurityValidator } from '../../tech-validation/utils/security-validator';
import { VideoProcessor } from '../../tech-validation/utils/video-processor';
import { AudioTranscriber } from '../../tech-validation/utils/audio-transcriber';
import { ScriptGenerator } from '../../tech-validation/utils/script-generator';
import { createMockAudioFile, MOCK_TRANSCRIPT } from '../../tech-validation/utils/mock-audio';

/**
 * 异步版本的视频转写 API
 * 立即返回任务 ID，客户端可以轮询查询状态
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: { message: 'Method not allowed' } 
    });
  }

  const startTime = Date.now();
  
  try {
    // 1. 参数提取和基本验证
    const { url, apiToken, style = 'default', language = 'zh-CN' } = req.body;
    
    // 验证必需参数
    if (!url || !apiToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_PARAMS',
          message: '缺少必需参数：url 和 apiToken 都是必需的'
        }
      });
    }
    
    // 执行安全验证
    const urlValidation = SecurityValidator.validateVideoUrl(url);
    if (!urlValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: urlValidation.reason || 'URL 验证失败'
        }
      });
    }
    
    const tokenValidation = SecurityValidator.validateApiToken(apiToken);
    if (!tokenValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: tokenValidation.reason || 'API Token 验证失败'
        }
      });
    }

    // 2. 生成任务 ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 3. 立即返回任务 ID
    res.status(202).json({
      success: true,
      taskId,
      status: 'processing',
      message: '任务已接受，正在处理中',
      checkUrl: `/api/video/check-status?taskId=${taskId}`
    });
    
    // 4. 异步处理（在实际生产环境中，这应该放到队列中）
    // 注意：在 Vercel Serverless 中，函数返回后会立即停止执行
    // 所以这种方式仅用于演示，实际需要使用消息队列服务
    
    console.log(`🚀 异步任务 ${taskId} 已创建`);
    
  } catch (error) {
    console.error('创建异步任务失败:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : '创建任务失败'
      }
    });
  }
}