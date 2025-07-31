const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'tech-validation/.env') });

// 检查环境变量
console.log('\n环境变量检查:');
console.log('- TIKHUB_API_TOKEN:', process.env.TIKHUB_API_TOKEN ? '✅ 已设置' : '❌ 未设置');
console.log('- YUNMAO_API_KEY:', process.env.YUNMAO_API_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('- YUNMAO_API_SECRET:', process.env.YUNMAO_API_SECRET ? '✅ 已设置' : '❌ 未设置');
console.log('- TONGYI_API_KEY:', process.env.TONGYI_API_KEY ? '✅ 已设置' : '❌ 未设置');

// 创建简单的测试服务器
const server = http.createServer((req, res) => {
  console.log(`\n收到请求: ${req.method} ${req.url}`);
  
  if (req.url === '/api/video/transcribe-v3' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      console.log('请求体:', body);
      
      // 模拟响应
      const response = {
        success: true,
        data: {
          originalText: '这是一个测试视频的转录文本内容...',
          script: {
            title: '测试视频脚本',
            duration: 60,
            scenes: [
              {
                scene_number: 1,
                timestamp: '00:00-00:20',
                description: '开场',
                dialogue: '大家好，这是一个测试视频',
                notes: '测试场景'
              }
            ]
          },
          processingTime: 5000,
          provider: {
            videoResolver: 'TikHub-Web (模拟)',
            transcription: 'Yunmao (模拟)',
            scriptGenerator: 'TongYi (模拟)'
          }
        }
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 简单测试服务器运行在: http://localhost:${PORT}`);
  console.log('\n这是一个模拟服务器，用于测试 API 端点是否正常工作');
  console.log('它不会真正调用第三方 API，只返回模拟数据\n');
});