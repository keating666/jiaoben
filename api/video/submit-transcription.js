// 提交视频转文字任务
const https = require('https');

async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // 仅支持 POST
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
    const requestData = JSON.stringify({
      language,
      fileUrl: videoUrl,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
      resultType: 'str',
      chat
    });
    
    console.log('发送到云猫的请求数据:', requestData);
    console.log('视频URL长度:', videoUrl.length);
    console.log('API Key 是否存在:', process.env.YUNMAO_API_KEY ? '是' : '否');
    console.log('API Key 长度:', process.env.YUNMAO_API_KEY ? process.env.YUNMAO_API_KEY.length : 0);
    
    const options = {
      hostname: 'api.guangfan.tech',
      path: '/v1/get-text',
      method: 'POST',
      headers: {
        'api-key': process.env.YUNMAO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 30000 // 30秒超时
    };
    
    // 发送请求
    const apiReq = https.request(options, (apiRes) => {
      let responseData = '';
      apiRes.on('data', chunk => responseData += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          console.log('云猫响应:', parsed);
          
          if (parsed.code === 0) {
            res.status(200).json({
              success: true,
              data: {
                taskId: parsed.data,
                message: '任务已提交，请稍后查询结果',
                checkUrl: `/api/video/check-transcription?taskId=${parsed.data}`
              }
            });
          } else {
            console.error('云猫 API 错误:', parsed);
            res.status(400).json({
              success: false,
              error: {
                code: `YUNMAO_${parsed.code}`,
                message: parsed.message || '云猫 API 错误',
                details: {
                  videoUrlLength: videoUrl.length,
                  response: responseData.substring(0, 200)
                }
              }
            });
          }
        } catch (error) {
          console.error('解析响应失败:', error);
          res.status(500).json({
            success: false,
            error: {
              code: 'PARSE_ERROR',
              message: '解析云猫响应失败'
            }
          });
        }
      });
    });
    
    apiReq.on('timeout', () => {
      console.error('请求超时');
      apiReq.destroy();
      res.status(500).json({
        success: false,
        error: {
          code: 'TIMEOUT_ERROR',
          message: '请求云猫API超时，请稍后重试'
        }
      });
    });
    
    apiReq.on('error', (error) => {
      console.error('请求失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REQUEST_ERROR',
          message: error.message
        }
      });
    });
    
    apiReq.write(requestData);
    apiReq.end();
    
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