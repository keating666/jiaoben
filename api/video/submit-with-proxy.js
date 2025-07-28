// 使用代理服务提交云猫任务
const https = require('https');
const http = require('http');

async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }
  
  try {
    const { videoUrl, language = 'chinese' } = req.body;
    
    if (!videoUrl) {
      res.status(400).json({
        success: false,
        error: '必须提供videoUrl'
      });
      return;
    }
    
    // 获取代理地址和API密钥
    const proxyUrl = process.env.YUNMAO_PROXY_URL;
    const apiKey = process.env.YUNMAO_API_KEY;
    
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: '未配置YUNMAO_API_KEY'
      });
      return;
    }
    
    let result;
    
    if (proxyUrl) {
      // 使用代理服务
      console.log(`[代理模式] 使用代理: ${proxyUrl}`);
      result = await submitViaProxy(proxyUrl, videoUrl, language, apiKey);
    } else {
      // 直接调用（降级方案）
      console.log('[直连模式] 直接调用云猫API');
      result = await submitDirect(videoUrl, language, apiKey);
    }
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: {
          taskId: result.taskId,
          message: '任务已提交',
          mode: proxyUrl ? 'proxy' : 'direct'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 通过代理提交
async function submitViaProxy(proxyUrl, videoUrl, language, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(proxyUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestData = JSON.stringify({
      videoUrl,
      language,
      apiKey
    });
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: '/proxy/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    const req = client.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.success && parsed.data && parsed.data.data) {
            resolve({
              success: true,
              taskId: parsed.data.data
            });
          } else {
            resolve({
              success: false,
              error: parsed.error || '代理服务返回错误'
            });
          }
        } catch (e) {
          reject(new Error('解析代理响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error('代理请求超时'));
    });
    
    req.write(requestData);
    req.end();
  });
}

// 直接调用云猫API
async function submitDirect(videoUrl, language, apiKey) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      language,
      fileUrl: videoUrl,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
      resultType: 'str',
      chat: false
    });
    
    const options = {
      hostname: 'api.guangfan.tech',
      path: '/v1/get-text',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode === 200 && parsed.code === 0) {
            resolve({
              success: true,
              taskId: parsed.data
            });
          } else {
            resolve({
              success: false,
              error: parsed.message || '云猫API错误'
            });
          }
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('直连请求超时'));
    });
    
    req.write(requestData);
    req.end();
  });
}

module.exports = handler;