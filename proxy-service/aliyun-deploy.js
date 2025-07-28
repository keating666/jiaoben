/**
 * 阿里云函数计算部署版本
 * 文档: https://help.aliyun.com/document_detail/74707.html
 */

const https = require('https');

/**
 * 阿里云函数计算入口
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @param {Object} context - 函数上下文
 */
exports.handler = async (req, res, context) => {
  console.log('收到请求:', req.method, req.path);
  
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, api-key');
  
  if (req.method === 'OPTIONS') {
    res.send('OK');
    return;
  }
  
  try {
    // 提交任务
    if (req.path === '/submit' && req.method === 'POST') {
      const body = JSON.parse(req.body);
      const result = await submitToYunmao(body);
      res.setStatusCode(200);
      res.send(JSON.stringify(result));
    }
    // 查询状态
    else if (req.path.startsWith('/status/') && req.method === 'GET') {
      const taskId = req.path.split('/')[2];
      const apiKey = req.headers['api-key'] || req.queries.apiKey;
      const result = await queryStatus(taskId, apiKey);
      res.setStatusCode(200);
      res.send(JSON.stringify(result));
    }
    // 健康检查
    else if (req.path === '/health') {
      res.setStatusCode(200);
      res.send(JSON.stringify({
        status: 'ok',
        service: 'yunmao-proxy-aliyun',
        timestamp: new Date().toISOString()
      }));
    }
    else {
      res.setStatusCode(404);
      res.send(JSON.stringify({ error: 'Not Found' }));
    }
  } catch (error) {
    console.error('处理错误:', error);
    res.setStatusCode(500);
    res.send(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
};

// 提交任务到云猫
async function submitToYunmao({ videoUrl, language = 'chinese', apiKey }) {
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
      },
      timeout: 30000
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    req.write(requestData);
    req.end();
  });
}

// 查询任务状态
async function queryStatus(taskId, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.guangfan.tech',
      path: `/v1/get-status?id=${taskId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      }
    };
    
    https.get(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data: parsed
          });
        } catch (e) {
          reject(new Error('解析响应失败'));
        }
      });
    }).on('error', reject);
  });
}