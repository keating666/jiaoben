/**
 * 测试Vercel部署区域的API
 */
module.exports = async (req, res) => {
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // 获取请求信息
  const region = process.env.VERCEL_REGION || 'unknown';
  const url = process.env.VERCEL_URL || 'unknown';
  
  // 尝试获取IP信息
  let ipInfo = {};
  try {
    const https = require('https');
    const response = await new Promise((resolve, reject) => {
      https.get('https://ipapi.co/json/', (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => { resolve(JSON.parse(data)); });
      }).on('error', reject);
    });
    ipInfo = response;
  } catch (error) {
    ipInfo = { error: error.message };
  }
  
  // 返回区域信息
  res.status(200).json({
    success: true,
    deployment: {
      region: region,
      url: url,
      timestamp: new Date().toISOString()
    },
    server: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    location: ipInfo,
    headers: {
      'x-vercel-id': req.headers['x-vercel-id'] || 'unknown',
      'x-vercel-deployment-url': req.headers['x-vercel-deployment-url'] || 'unknown'
    }
  });
};