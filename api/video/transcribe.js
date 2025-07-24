// 简化版的 transcribe API - 使用 JavaScript 避免 TypeScript 编译问题
export default async function handler(req, res) {
  console.log('=== Video Transcribe API Started ===');
  
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { mixedText, video_url, style = 'default', language = 'zh' } = req.body;
    
    console.log('Request received:', { 
      hasMixedText: !!mixedText, 
      hasVideoUrl: !!video_url,
      style,
      language 
    });
    
    // 临时返回模拟数据，确保 API 能正常响应
    const mockResponse = {
      success: true,
      data: {
        original_text: "这是一个测试视频的转录文本",
        script: {
          title: "测试视频脚本",
          duration: 60,
          scenes: [
            {
              scene_number: 1,
              timestamp: "00:00-00:30",
              description: "开场画面",
              dialogue: "欢迎观看这个测试视频",
              notes: "测试场景"
            },
            {
              scene_number: 2,
              timestamp: "00:30-01:00",
              description: "结束画面",
              dialogue: "感谢观看",
              notes: "测试结束"
            }
          ]
        },
        processing_time: 3000,
        metadata: {
          video_url: video_url || "从混合文本中提取",
          style: style,
          language: language
        }
      },
      message: "API 正在恢复中，这是模拟响应"
    };
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.status(200).json(mockResponse);
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred'
    });
  }
}