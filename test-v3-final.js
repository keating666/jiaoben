const http = require('http');

// 测试数据
const testData = {
  mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了',
  style: 'humorous'
};

// 请求选项
const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/video/transcribe-v3',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-api-key-123'
  }
};

console.log('🚀 测试 Transcribe V3 简化版...\n');
console.log('请求数据:', JSON.stringify(testData, null, 2));
console.log('\n发送请求...\n');

const req = http.request(options, (res) => {
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
        console.log('\n✅ 测试成功！');
        console.log('\n关键信息:');
        console.log('- 处理时间:', parsed.data.processingTime + 'ms');
        console.log('- 原文长度:', parsed.data.originalText.length);
        console.log('- 场景数量:', parsed.data.script.scenes ? parsed.data.script.scenes.length : 0);
        console.log('- 服务提供商:', JSON.stringify(parsed.data.provider));
      } else {
        console.log('\n❌ 测试失败');
      }
    } catch (e) {
      console.log('响应解析错误:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求错误:', error.message);
  console.log('\n请确保测试服务器正在运行（端口 3003）');
  console.log('运行命令: node test-v3-server.js');
});

// 发送请求
req.write(JSON.stringify(testData));
req.end();