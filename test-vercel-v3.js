const https = require('https');

// 测试数据
const testData = JSON.stringify({
  mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了',
  style: 'humorous'
});

// 请求选项
const options = {
  hostname: 'jiaoben.vercel.app',
  path: '/api/video/transcribe-v3',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-api-key-123',
    'Content-Length': Buffer.byteLength(testData)
  }
};

console.log('发送测试请求到 Vercel 部署的 transcribe-v3...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('状态码:', res.statusCode);
    console.log('响应内容:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('请求错误:', error.message);
});

// 发送请求
req.write(testData);
req.end();