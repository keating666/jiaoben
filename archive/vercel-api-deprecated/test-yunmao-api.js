const https = require('https');

async function handler(req, res) {
  console.log(`[测试] 云猫API测试开始`);
  
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // 测试环境变量
    const apiKey = process.env.YUNMAO_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: '未配置YUNMAO_API_KEY环境变量'
      });
      return;
    }
    
    console.log(`[测试] API密钥长度: ${apiKey.length}`);
    console.log(`[测试] API密钥前4位: ${apiKey.substring(0, 4)}...`);
    
    // 测试提交任务
    const testVideoUrl = 'https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4';
    
    const requestData = JSON.stringify({
      language: 'chinese',
      fileUrl: testVideoUrl,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
      resultType: 'str',
      chat: false
    });
    
    console.log(`[测试] 请求数据:`, requestData);
    
    const submitPromise = new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.guangfan.tech',
        path: '/v1/get-text',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'api-key': apiKey,
          'Content-Length': Buffer.byteLength(requestData)
        }
      };
      
      console.log(`[测试] 请求选项:`, JSON.stringify(options, null, 2));
      
      const req = https.request(options, (apiRes) => {
        let responseData = '';
        
        console.log(`[测试] 响应状态码: ${apiRes.statusCode}`);
        console.log(`[测试] 响应头:`, apiRes.headers);
        
        apiRes.on('data', chunk => responseData += chunk);
        apiRes.on('end', () => {
          console.log(`[测试] 响应数据:`, responseData);
          
          try {
            const parsed = JSON.parse(responseData);
            resolve({
              statusCode: apiRes.statusCode,
              data: parsed
            });
          } catch (e) {
            resolve({
              statusCode: apiRes.statusCode,
              rawData: responseData,
              parseError: e.message
            });
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`[测试] 请求错误:`, error);
        reject(error);
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      req.write(requestData);
      req.end();
    });
    
    const result = await submitPromise;
    
    // 如果提交成功，尝试查询状态
    let statusResult = null;
    if (result.statusCode === 200 && result.data?.code === 0 && result.data?.data) {
      const taskId = result.data.data;
      console.log(`[测试] 获取到任务ID: ${taskId}`);
      
      // 等待2秒后查询状态
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      statusResult = await new Promise((resolve, reject) => {
        const statusOptions = {
          hostname: 'api.guangfan.tech',
          path: `/v1/get-status?id=${taskId}`,
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            'api-key': apiKey
          }
        };
        
        console.log(`[测试] 状态查询URL: https://${statusOptions.hostname}${statusOptions.path}`);
        
        const statusReq = https.request(statusOptions, (statusRes) => {
          let statusData = '';
          
          console.log(`[测试] 状态查询响应码: ${statusRes.statusCode}`);
          
          statusRes.on('data', chunk => statusData += chunk);
          statusRes.on('end', () => {
            console.log(`[测试] 状态查询响应:`, statusData);
            
            try {
              const parsed = JSON.parse(statusData);
              resolve({
                statusCode: statusRes.statusCode,
                data: parsed
              });
            } catch (e) {
              resolve({
                statusCode: statusRes.statusCode,
                rawData: statusData
              });
            }
          });
        });
        
        statusReq.on('error', reject);
        statusReq.end();
      });
    }
    
    // 返回测试结果
    res.status(200).json({
      success: true,
      apiKeyConfigured: true,
      submitTest: result,
      statusTest: statusResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[测试] 错误:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

module.exports = handler;