// 测试 API - 纯 JavaScript，不依赖 TypeScript
export default async function handler(req, res) {
  console.log('Test Simple API called');
  
  try {
    // 测试基本功能
    const result = {
      status: 'ok',
      method: req.method,
      timestamp: new Date().toISOString(),
      env: {
        hasMinimaxKey: !!process.env.MINIMAX_API_KEY,
        hasTongyiKey: !!process.env.TONGYI_API_KEY,
      }
    };

    // 测试动态导入
    try {
      // 尝试加载一个简单的 JS 模块
      const fs = await import('fs');
      result.fsModule = 'loaded';
    } catch (e) {
      result.fsModule = 'failed: ' + e.message;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Test API Error:', error);
    res.status(500).json({
      error: 'Internal error',
      message: error.message,
    });
  }
}