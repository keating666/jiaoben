const https = require('https');

// 测试数据
const testData = JSON.stringify({
  mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了',
  style: 'humorous'
});

// 请求选项
const options = {
  hostname: 'jiaoben.vercel.app',
  path: '/api/video/transcribe-v3-simple',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-api-key-123',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('🚀 测试 Vercel 部署的 transcribe-v3-simple...\n');
console.log('URL: https://jiaoben.vercel.app/api/video/transcribe-v3-simple');
console.log('请求数据:', JSON.parse(testData));
console.log('\n发送请求...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('状态码:', res.statusCode);
    console.log('\n响应头:');
    console.log('- Content-Type:', res.headers['content-type']);
    console.log('- x-vercel-id:', res.headers['x-vercel-id']);
    
    console.log('\n响应内容:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.success) {
        console.log('\n✅ 部署成功！API 正常工作');
        console.log('\n可以通过以下 URL 访问:');
        console.log('https://jiaoben.vercel.app/api/video/transcribe-v3-simple');
      } else {
        console.log('\n⚠️  API 返回错误');
      }
    } catch (e) {
      console.log(data);
      console.log('\n❌ 响应解析失败');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求错误:', error.message);
});

// 发送请求
req.write(testData);
req.end();