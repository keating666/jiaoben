// 提交视频转文字任务 - 使用 fetch API
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
    const requestData = {
      language,
      fileUrl: videoUrl,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
      resultType: 'str',
      chat
    };
    
    console.log('发送到云猫的请求数据:', JSON.stringify(requestData));
    console.log('API Key 是否存在:', process.env.YUNMAO_API_KEY ? '是' : '否');
    
    // 使用 fetch API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    try {
      const response = await fetch('https://api.guangfan.tech/v1/get-text', {
        method: 'POST',
        headers: {
          'api-key': process.env.YUNMAO_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      console.log('云猫响应状态:', response.status);
      console.log('云猫响应:', responseText);
      
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        console.error('解析响应失败:', e);
        res.status(500).json({
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: '解析云猫响应失败',
            details: responseText.substring(0, 200)
          }
        });
        return;
      }
      
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
            message: parsed.message || '云猫 API 错误'
          }
        });
      }
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error('请求超时');
        res.status(500).json({
          success: false,
          error: {
            code: 'TIMEOUT_ERROR',
            message: '请求云猫API超时，请稍后重试'
          }
        });
      } else {
        console.error('Fetch 错误:', fetchError);
        res.status(500).json({
          success: false,
          error: {
            code: 'FETCH_ERROR',
            message: fetchError.message || '网络请求失败'
          }
        });
      }
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