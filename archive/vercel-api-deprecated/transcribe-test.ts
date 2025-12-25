import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 测试版本的视频转写 API - 用于演示，跳过 token 验证
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
    const { url, apiToken } = req.body;
    
    // 基本参数验证
    if (!url || !apiToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_PARAMS',
          message: '缺少必需参数：url 和 apiToken 都是必需的'
        }
      });
    }
    
    // 生成任务 ID
    const taskId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 模拟异步处理结果
    const mockResult = {
      taskId,
      status: 'completed',
      result: {
        original_text: '大家好，欢迎来到我的抖音视频。今天我要跟大家分享一个非常有趣的内容。',
        script: {
          title: '测试视频脚本',
          duration: 30,
          scenes: [
            {
              scene_number: 1,
              timestamp: '00:00-00:10',
              description: '开场画面',
              dialogue: '大家好，欢迎来到我的抖音视频',
              notes: '欢快的背景音乐'
            },
            {
              scene_number: 2,
              timestamp: '00:10-00:20',
              description: '主要内容',
              dialogue: '今天我要跟大家分享一个非常有趣的内容',
              notes: '展示核心内容'
            },
            {
              scene_number: 3,
              timestamp: '00:20-00:30',
              description: '结尾',
              dialogue: '感谢观看，记得点赞关注',
              notes: '呼吁互动'
            }
          ]
        },
        processing_time: Date.now() - startTime
      }
    };
    
    // 立即返回完成的结果（用于测试）
    res.status(200).json({
      success: true,
      ...mockResult,
      message: '测试版本 - 立即返回模拟结果'
    });
    
  } catch (error) {
    console.error('测试 API 失败:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : '处理失败'
      }
    });
  }
}