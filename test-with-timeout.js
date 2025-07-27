const https = require('https');

// 测试配置
const config = {
  hostname: 'jiaoben.vercel.app',
  path: '/api/video/transcribe-v3-simple',
  timeout: 30000 // 30秒超时
};

// 测试函数
function testAPI() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了',
      style: 'humorous'
    });

    const options = {
      hostname: config.hostname,
      path: config.path,
      method: 'POST',
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-api-key-123',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'Node.js Test Client'
      }
    };

    console.log('🚀 测试 Vercel API...');
    console.log(`URL: https://${config.hostname}${config.path}`);
    console.log('超时设置:', config.timeout + 'ms');
    console.log('\n发送请求...\n');

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log('状态码:', res.statusCode);
        
        try {
          const parsed = JSON.parse(responseData);
          console.log('\n响应:', JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.log('\n原始响应:', responseData);
          resolve(responseData);
        }
      });
    });

    req.on('timeout', () => {
      console.error('❌ 请求超时');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', (error) => {
      console.error('❌ 请求错误:', error.message);
      console.error('错误代码:', error.code);
      
      if (error.code === 'ECONNRESET') {
        console.log('\n提示: 连接被重置，可能是网络问题或服务器问题');
      } else if (error.code === 'ETIMEDOUT') {
        console.log('\n提示: 连接超时，请检查网络或稍后重试');
      }
      
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// 重试机制
async function testWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`\n尝试 #${i + 1}...`);
      const result = await testAPI();
      console.log('\n✅ 测试成功！');
      return result;
    } catch (error) {
      console.log(`\n第 ${i + 1} 次尝试失败`);
      
      if (i < maxRetries - 1) {
        const delay = (i + 1) * 2000; // 递增延迟
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.log('\n❌ 所有尝试都失败了');
}

// 运行测试
testWithRetry();