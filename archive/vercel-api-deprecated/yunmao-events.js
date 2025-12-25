// Server-Sent Events endpoint for real-time updates
module.exports = async function handler(req, res) {
  // 设置SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const taskId = req.query.taskId;
  
  if (!taskId) {
    res.write(`data: ${JSON.stringify({ error: 'Missing taskId' })}\n\n`);
    res.end();
    return;
  }
  
  console.log(`[SSE] 客户端连接，监听任务: ${taskId}`);
  
  // 发送初始状态
  res.write(`data: ${JSON.stringify({ status: 'connected', taskId })}\n\n`);
  
  // 检查任务状态的函数
  let checkCount = 0;
  const maxChecks = 60; // 最多检查60次（5分钟）
  
  const checkInterval = setInterval(() => {
    checkCount++;
    
    // 检查全局存储中是否有结果
    if (global.yunmaoResults && global.yunmaoResults[taskId]) {
      const result = global.yunmaoResults[taskId];
      
      if (result.status === 'completed' || result.status === 'failed') {
        // 发送最终结果
        res.write(`data: ${JSON.stringify({
          status: result.status,
          data: result.text || result.error,
          processingTime: result.processingTime
        })}\n\n`);
        
        // 清理并关闭连接
        clearInterval(checkInterval);
        res.end();
        
        console.log(`[SSE] 任务 ${taskId} 完成，关闭连接`);
        return;
      }
    }
    
    // 发送心跳
    res.write(`data: ${JSON.stringify({ 
      status: 'processing', 
      checkCount,
      elapsed: checkCount * 5 
    })}\n\n`);
    
    // 超时检查
    if (checkCount >= maxChecks) {
      res.write(`data: ${JSON.stringify({ 
        status: 'timeout',
        error: '处理超时'
      })}\n\n`);
      clearInterval(checkInterval);
      res.end();
      console.log(`[SSE] 任务 ${taskId} 超时，关闭连接`);
    }
  }, 5000); // 每5秒检查一次
  
  // 客户端断开连接时清理
  req.on('close', () => {
    clearInterval(checkInterval);
    console.log(`[SSE] 客户端断开连接，任务: ${taskId}`);
  });
};