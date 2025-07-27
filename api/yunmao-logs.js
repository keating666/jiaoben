// 查看云猫回调存储的结果
module.exports = async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }
  
  // 返回所有存储的结果
  const results = global.yunmaoResults || {};
  const taskCount = Object.keys(results).length;
  
  res.status(200).json({
    success: true,
    data: {
      taskCount,
      results,
      timestamp: new Date().toISOString()
    }
  });
};