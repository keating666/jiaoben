const http = require('http');
const handler = require('./api/video/transcribe-v3-simple');

// 创建服务器
const server = http.createServer(async (req, res) => {
  console.log(`收到请求: ${req.method} ${req.url}`);
  
  if (req.url === '/api/video/transcribe-v3' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const parsedBody = JSON.parse(body);
        
        // 创建模拟的请求和响应对象
        const mockReq = {
          method: 'POST',
          headers: req.headers,
          body: parsedBody,
          url: req.url
        };
        
        const mockRes = {
          statusCode: 200,
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data, null, 2));
          }
        };
        
        // 调用处理器
        await handler(mockReq, mockRes);
        
      } catch (error) {
        console.error('处理请求时出错:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false,
          error: { 
            code: 'INTERNAL_ERROR',
            message: error.message
          } 
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3003;
server.listen(PORT, () => {
  console.log(`\n✅ Transcribe V3 (简化版) 测试服务器运行在: http://localhost:${PORT}`);
  console.log('\n可以使用以下命令测试:');
  console.log(`\ncurl -X POST http://localhost:${PORT}/api/video/transcribe-v3 \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer test-api-key-123" \\
  -d '{"mixedText": "看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了", "style": "humorous"}'`);
  console.log('\n按 Ctrl+C 停止服务器\n');
});