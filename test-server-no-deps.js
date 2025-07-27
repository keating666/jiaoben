const http = require('http');

console.log('\n启动最简单的测试服务器...');
console.log('不检查环境变量，只返回模拟数据\n');

// 创建服务器
const server = http.createServer((req, res) => {
  console.log(`收到请求: ${req.method} ${req.url}`);
  
  // 打印请求头
  console.log('请求头:', JSON.stringify(req.headers, null, 2));
  
  if (req.url === '/api/video/transcribe-v3' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      console.log('请求体:', body);
      
      try {
        const requestData = JSON.parse(body);
        console.log('解析的请求数据:', requestData);
        
        // 检查授权头
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer ')) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: '未提供有效的API密钥',
              userMessage: '认证失败，请检查API密钥',
              retryable: false
            }
          }));
          return;
        }
        
        // 检查是否有视频链接
        if (!requestData.mixedText && !requestData.videoUrl) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '必须提供 mixedText 或 videoUrl',
              userMessage: '请提供视频链接或包含链接的文本',
              retryable: false
            }
          }));
          return;
        }
        
        // 模拟成功响应
        const response = {
          success: true,
          data: {
            originalText: '这是一个测试视频的转录文本。视频内容非常有趣，包含了各种搞笑的片段...',
            script: {
              title: '测试视频脚本',
              duration: 60,
              scenes: [
                {
                  scene_number: 1,
                  timestamp: '00:00-00:20',
                  description: '开场画面',
                  dialogue: '大家好，欢迎来到搞笑视频时间',
                  notes: '轻松愉快的背景音乐'
                },
                {
                  scene_number: 2,
                  timestamp: '00:20-00:40',
                  description: '主要内容',
                  dialogue: '今天要给大家分享一个超级有趣的故事',
                  notes: '镜头切换到主角'
                },
                {
                  scene_number: 3,
                  timestamp: '00:40-01:00',
                  description: '结尾',
                  dialogue: '感谢观看，记得点赞关注哦',
                  notes: '显示关注按钮'
                }
              ]
            },
            processingTime: Math.floor(Math.random() * 10000) + 5000,
            provider: {
              videoResolver: 'TikHub-Web (模拟)',
              transcription: 'Yunmao (模拟)',
              scriptGenerator: 'TongYi (模拟)'
            }
          }
        };
        
        console.log('\n返回模拟响应...');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response, null, 2));
        
      } catch (error) {
        console.error('处理请求时出错:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: '服务器内部错误',
            userMessage: '服务暂时不可用，请稍后重试',
            retryable: true
          }
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ 测试服务器已启动: http://localhost:${PORT}`);
  console.log('\n可以使用以下命令测试:');
  console.log(`node test-v3-simple.js`);
  console.log('\n或使用 curl:');
  console.log(`curl -X POST http://localhost:${PORT}/api/video/transcribe-v3 \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer test-api-key-123" \\
  -d '{"mixedText": "测试视频 https://v.douyin.com/test/"}'`);
  console.log('\n按 Ctrl+C 停止服务器\n');
});