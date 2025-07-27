// 查询云猫任务结果端点
// 通过任务ID查询处理结果

module.exports = async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // 仅支持 GET
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }
  
  try {
    const { taskId } = req.query;
    
    if (!taskId) {
      res.status(400).json({
        success: false,
        error: 'Missing taskId parameter'
      });
      return;
    }
    
    console.log('查询云猫任务结果:', taskId);
    
    // 从内存中获取结果
    const result = global.yunmaoResults?.[taskId];
    
    if (!result) {
      // 未找到结果，可能还在处理中
      console.log(`任务 ${taskId} 结果未找到`);
      res.status(404).json({
        success: false,
        error: 'Result not found',
        status: 'pending',
        taskId
      });
      return;
    }
    
    // 返回结果
    console.log(`返回任务 ${taskId} 结果:`, {
      status: result.status,
      hasText: !!result.text,
      textLength: result.text?.length || 0
    });
    
    res.status(200).json({
      success: true,
      taskId,
      ...result
    });
    
  } catch (error) {
    console.error('查询云猫结果失败:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};