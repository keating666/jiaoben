// 云猫（广帆）API 回调端点
// 接收异步处理完成的通知

// 简单的内存存储（生产环境应使用 Redis 或数据库）
// 使用全局变量在 Vercel 中可能会有限制，但用于测试足够了
if (!global.yunmaoResults) {
  global.yunmaoResults = {};
}

module.exports = async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('收到云猫回调，请求体:', JSON.stringify(req.body, null, 2));
  
  // 仅支持 POST
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }
  
  try {
    // 解析回调数据
    const { taskId, code, data, message } = req.body;
    
    if (!taskId) {
      console.error('回调缺少 taskId');
      res.status(400).json({
        success: false,
        error: 'Missing taskId'
      });
      return;
    }
    
    console.log('处理云猫回调:', {
      taskId,
      code,
      message,
      dataType: typeof data,
      dataLength: typeof data === 'string' ? data.length : 'N/A'
    });
    
    // 存储结果
    if (code === 0) {
      // 成功
      global.yunmaoResults[taskId] = {
        status: 'completed',
        text: data, // 如果 resultType 是 'str'，这里是文本内容
        fileUrl: typeof data === 'string' && data.startsWith('http') ? data : null,
        completedAt: new Date().toISOString(),
        processingTime: Date.now() - (global.yunmaoResults[taskId]?.createdAt || Date.now())
      };
      
      console.log(`任务 ${taskId} 完成，文本长度: ${typeof data === 'string' ? data.length : 0}`);
    } else {
      // 失败
      global.yunmaoResults[taskId] = {
        status: 'failed',
        error: message || `错误代码: ${code}`,
        failedAt: new Date().toISOString()
      };
      
      console.error(`任务 ${taskId} 失败:`, message);
    }
    
    // 返回成功响应给云猫
    res.status(200).json({
      success: true,
      received: true,
      taskId
    });
    
  } catch (error) {
    console.error('处理云猫回调失败:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};