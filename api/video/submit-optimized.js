// 优化版视频提交端点 - 使用回调机制
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
    
    // 准备云猫 API 请求
    const requestData = {
      language,
      fileUrl: videoUrl,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
      resultType: 'str', // 直接返回字符串，避免再次下载文件
      chat
    };
    
    console.log('提交到云猫:', {
      language,
      videoUrl: videoUrl.substring(0, 50) + '...',
      notifyUrl: requestData.notifyUrl
    });
    
    const startTime = Date.now();
    
    // 使用 Promise 包装 https 请求
    const response = await new Promise((resolve, reject) => {
      const postData = JSON.stringify(requestData);
      
      const options = {
        hostname: 'api.guangfan.tech',
        path: '/v1/get-text',
        method: 'POST',
        headers: {
          'api-key': process.env.YUNMAO_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (apiRes) => {
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
      });
      
      req.on('error', (error) => {
        console.error('[云猫] 请求错误:', error);
        reject(error);
      });
      
      // 增加超时时间到30秒
      req.setTimeout(30000, () => {
        req.destroy();
        console.error('[云猫] 请求超时（30秒）');
        reject(new Error('请求超时（30秒）'));
      });
      
      req.write(postData);
      req.end();
    });
    
    const submitTime = Date.now() - startTime;
    console.log(`云猫响应时间: ${submitTime}ms`);
    
    if (response.status === 200 && response.data.code === 0) {
      const taskId = response.data.data;
      
      // 记录任务创建时间
      global.yunmaoResults[taskId] = {
        status: 'processing',
        createdAt: Date.now(),
        videoUrl,
        language
      };
      
      res.status(200).json({
        success: true,
        data: {
          taskId,
          message: '任务已提交，正在处理中',
          submitTime: `${submitTime}ms`,
          // 提供多种获取结果的方式
          endpoints: {
            check: `/api/video/check-transcription?taskId=${taskId}`,
            events: `/api/yunmao-events?taskId=${taskId}`
          }
        }
      });
    } else {
      console.error('云猫 API 错误:', response.data);
      res.status(400).json({
        success: false,
        error: {
          code: `YUNMAO_${response.data.code}`,
          message: response.data.message || '云猫 API 错误'
        }
      });
    }
    
  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}

module.exports = handler;