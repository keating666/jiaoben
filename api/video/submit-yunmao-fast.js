// 优化版云猫提交 - 快速响应版本
const https = require('https');

// 确保全局存储存在
if (!global.yunmaoResults) {
  global.yunmaoResults = {};
}

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
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: '仅支持 POST 请求'
      }
    });
    return;
  }
  
  try {
    const { videoUrl, language = 'chinese', chat = false } = req.body;
    
    if (!videoUrl) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须提供 videoUrl'
        }
      });
      return;
    }
    
    // 检查API密钥
    const apiKey = process.env.YUNMAO_API_KEY;
    if (!apiKey) {
      console.error('[云猫] 未配置API密钥');
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_ERROR',
          message: '未配置YUNMAO_API_KEY'
        }
      });
      return;
    }
    
    console.log('[云猫] 开始提交任务...');
    console.log('[云猫] 视频URL:', videoUrl);
    
    // 准备请求数据
    const requestData = JSON.stringify({
      language,
      fileUrl: videoUrl,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
      resultType: 'str',
      chat
    });
    
    // 创建Promise但设置较短超时
    const submitPromise = new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.guangfan.tech',
        path: '/v1/get-text',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
          'Content-Length': Buffer.byteLength(requestData)
        },
        // 添加代理和超时设置
        timeout: 15000, // 15秒超时
        agent: new https.Agent({
          keepAlive: false,
          timeout: 15000
        })
      };
      
      const req = https.request(options, (apiRes) => {
        let responseData = '';
        
        apiRes.on('data', chunk => {
          responseData += chunk;
        });
        
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            console.log('[云猫] API响应:', parsed);
            resolve({ status: apiRes.statusCode, data: parsed });
          } catch (e) {
            console.error('[云猫] 解析响应失败:', e);
            reject(new Error('解析响应失败'));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error('[云猫] 请求错误:', error);
        reject(error);
      });
      
      // 设置请求超时
      req.setTimeout(15000, () => {
        console.error('[云猫] 请求超时（15秒）');
        req.destroy();
        reject(new Error('请求超时（15秒）'));
      });
      
      req.write(requestData);
      req.end();
    });
    
    // 等待响应
    const response = await submitPromise;
    
    if (response.status === 200 && response.data.code === 0) {
      const taskId = response.data.data;
      
      // 记录任务信息
      global.yunmaoResults[taskId] = {
        status: 'processing',
        createdAt: Date.now(),
        videoUrl,
        language
      };
      
      console.log(`[云猫] 任务创建成功: ${taskId}`);
      
      res.status(200).json({
        success: true,
        data: {
          taskId,
          message: '任务已提交，正在处理中',
          submitTime: Date.now(),
          endpoints: {
            check: `/api/video/check-transcription?taskId=${taskId}`,
            events: `/api/yunmao-events?taskId=${taskId}`
          }
        }
      });
    } else {
      console.error('[云猫] API返回错误:', response.data);
      res.status(400).json({
        success: false,
        error: {
          code: `YUNMAO_${response.data.code}`,
          message: response.data.message || '云猫 API 错误',
          details: response.data
        }
      });
    }
    
  } catch (error) {
    console.error('[云猫] 处理错误:', error);
    
    // 特殊处理超时错误
    if (error.message.includes('超时')) {
      res.status(504).json({
        success: false,
        error: {
          code: 'TIMEOUT',
          message: '云猫API响应超时，请稍后重试',
          suggestion: '请尝试使用更小的视频文件'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      });
    }
  }
}

module.exports = handler;