const http = require('http');

// 测试配置
const PORT = 3002; // 注意端口改为 3002
const testCases = [
  {
    name: '测试1: 基础功能',
    data: {
      mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了',
      style: 'humorous'
    }
  },
  {
    name: '测试2: 错误处理 - 无视频链接',
    data: {
      mixedText: '这里没有任何视频链接',
      style: 'default'
    }
  },
  {
    name: '测试3: 错误处理 - 无授权',
    data: {
      videoUrl: 'https://v.douyin.com/iRyLb8kf/'
    },
    noAuth: true
  }
];

// 发送测试请求
function sendTestRequest(testCase) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(testCase.data);
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/video/transcribe-v3',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    // 添加授权头（除非明确不要）
    if (!testCase.noAuth) {
      options.headers['Authorization'] = 'Bearer test-api-key-123';
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📝 ${testCase.name}`);
    console.log('请求数据:', testCase.data);
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n状态码: ${res.statusCode}`);
        
        try {
          const parsed = JSON.parse(responseData);
          console.log('响应:', JSON.stringify(parsed, null, 2));
          
          if (parsed.success) {
            console.log('✅ 测试通过');
            if (parsed.data?.provider) {
              console.log('\n使用的服务:');
              console.log('- 视频解析:', parsed.data.provider.videoResolver);
              console.log('- 转录:', parsed.data.provider.transcription);
              console.log('- 脚本生成:', parsed.data.provider.scriptGenerator);
            }
          } else {
            console.log('❌ 测试失败（预期的错误）');
          }
          
          resolve(parsed);
        } catch (e) {
          console.log('响应解析错误:', responseData);
          reject(e);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ 请求错误:', error.message);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

// 运行所有测试
async function runAllTests() {
  console.log('开始测试 transcribe-v3 真实 API...\n');
  
  for (const testCase of testCases) {
    try {
      await sendTestRequest(testCase);
      // 等待一下，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('测试执行错误:', error);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('所有测试完成！');
}

// 检查服务器是否运行
const checkReq = http.get(`http://localhost:${PORT}/`, (res) => {
  console.error(`\n❌ 测试服务器响应了不应该响应的请求，可能配置有误`);
  runAllTests();
}).on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.error(`\n❌ 无法连接到测试服务器 (端口 ${PORT})`);
    console.error('请确保已运行: node test-real-v3.js');
  } else {
    runAllTests();
  }
});