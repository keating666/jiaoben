/**
 * 云猫API中转服务
 * 可部署到阿里云函数计算、腾讯云函数或任何Node.js服务器
 */

const express = require('express');
const https = require('https');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 配置CORS
app.use(cors());
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'yunmao-proxy',
    timestamp: new Date().toISOString() 
  });
});

// 代理提交任务
app.post('/proxy/submit', async (req, res) => {
  console.log('[代理] 收到提交请求');
  
  try {
    const { videoUrl, language = 'chinese', notifyUrl, apiKey } = req.body;
    
    if (!videoUrl || !apiKey) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: videoUrl 或 apiKey'
      });
    }
    
    const requestData = JSON.stringify({
      language,
      fileUrl: videoUrl,
      notifyUrl: notifyUrl || `${req.protocol}://${req.get('host')}/proxy/callback`,
      resultType: 'str',
      chat: false
    });
    
    const startTime = Date.now();
    
    // 调用云猫API
    const response = await new Promise((resolve, reject) => {
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
      
      const req = https.request(options, (apiRes) => {
        let responseData = '';
        apiRes.on('data', chunk => responseData += chunk);
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve({ 
              status: apiRes.statusCode, 
              data: parsed,
              time: Date.now() - startTime 
            });
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      req.write(requestData);
      req.end();
    });
    
    console.log(`[代理] 云猫响应: ${response.status}, 耗时: ${response.time}ms`);
    
    res.json({
      success: response.status === 200,
      data: response.data,
      proxyTime: response.time,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[代理] 错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 代理状态查询
app.get('/proxy/status/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const apiKey = req.headers['api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: '缺少API密钥'
    });
  }
  
  try {
    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.guangfan.tech',
        path: `/v1/get-status?id=${taskId}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        }
      };
      
      https.get(options, (apiRes) => {
        let responseData = '';
        apiRes.on('data', chunk => responseData += chunk);
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            resolve({ status: apiRes.statusCode, data: parsed });
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        });
      }).on('error', reject);
    });
    
    res.json({
      success: response.status === 200,
      data: response.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 接收回调
app.post('/proxy/callback', (req, res) => {
  console.log('[代理] 收到云猫回调:', req.body);
  
  // 这里可以转发到Vercel或存储结果
  // 暂时只记录日志
  
  res.json({ success: true });
});

// 启动服务器（用于本地或VPS部署）
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`云猫代理服务运行在端口 ${PORT}`);
  });
}

// 导出app用于云函数
module.exports = app;