const https = require('https');

// 测试数据
const testData = JSON.stringify({
  mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了',
  style: 'humorous'
});

// 正确的域名（从您的截图看到的）
const options = {
  hostname: 'jiaoben-7jx4.vercel.app',  // 注意：是 jiaoben-7jx4，不是 jiaoben
  path: '/api/video/transcribe-v3-simple',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-api-key-123',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('🚀 测试 Vercel 部署的 API...\n');
console.log('URL: https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple');
console.log('\n发送请求...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('状态码:', res.statusCode);
    console.log('\n响应内容:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.success) {
        console.log('\n✅ API 测试成功！');
        console.log('\n正确的 API 地址是:');
        console.log('https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求错误:', error.message);
});

req.write(testData);
req.end();