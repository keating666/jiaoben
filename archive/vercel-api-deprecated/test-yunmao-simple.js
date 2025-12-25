// 最简单的云猫API测试
async function handler(req, res) {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // 直接返回测试信息
  const apiKey = process.env.YUNMAO_API_KEY;
  
  // 生成curl命令供测试
  const curlCommand = `curl -X POST https://api.guangfan.tech/v1/get-text \\
  -H "Content-Type: application/json" \\
  -H "api-key: ${apiKey ? '已配置' : '未配置'}" \\
  -d '{
    "language": "chinese",
    "fileUrl": "https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4",
    "notifyUrl": "https://jiaoben-7jx4.vercel.app/api/yunmao-callback",
    "resultType": "str",
    "chat": false
  }'`;
  
  res.status(200).json({
    success: true,
    apiKeyConfigured: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'N/A',
    testCommand: curlCommand,
    timestamp: new Date().toISOString(),
    message: '请在本地终端运行上面的curl命令测试API是否正常'
  });
}

module.exports = handler;