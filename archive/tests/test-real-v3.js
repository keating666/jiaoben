// 测试真实的 transcribe-v3 端点
const http = require('http');
const fs = require('fs');
const path = require('path');

// 手动加载环境变量
const envPath = path.join(__dirname, 'tech-validation/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('✅ 已加载环境变量');
} else {
  console.log('❌ 未找到 .env 文件');
}

// 检查关键环境变量
console.log('\n环境变量状态:');
console.log('- TIKHUB_API_TOKEN:', process.env.TIKHUB_API_TOKEN ? '✅' : '❌');
console.log('- YUNMAO_API_KEY:', process.env.YUNMAO_API_KEY ? '✅' : '❌');
console.log('- TONGYI_API_KEY:', process.env.TONGYI_API_KEY ? '✅' : '❌');

// 动态导入 transcribe-v3 处理器
let handler;
try {
  handler = require('./api/video/transcribe-v3').default;
  console.log('\n✅ 成功加载 transcribe-v3 处理器');
} catch (error) {
  console.error('\n❌ 无法加载 transcribe-v3:', error.message);
  process.exit(1);
}

// 创建服务器
const server = http.createServer(async (req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  if (req.url === '/api/video/transcribe-v3' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const parsedBody = JSON.parse(body);
        console.log('请求数据:', parsedBody);
        
        // 创建模拟的 Vercel 请求/响应对象
        const mockReq = {
          method: 'POST',
          headers: req.headers,
          body: parsedBody,
          url: req.url,
          query: {},
          cookies: {}
        };
        
        let responseData;
        let statusCode = 200;
        
        const mockRes = {
          status: (code) => {
            statusCode = code;
            return mockRes;
          },
          json: (data) => {
            responseData = data;
            console.log(`\n响应 (${statusCode}):`, JSON.stringify(data, null, 2));
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          },
          setHeader: () => mockRes,
          end: () => mockRes
        };
        
        // 调用真实的处理器
        console.log('\n调用 transcribe-v3 处理器...');
        await handler(mockReq, mockRes);
        
      } catch (error) {
        console.error('处理请求时出错:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false,
          error: { 
            code: 'INTERNAL_ERROR',
            message: error.message,
            stack: error.stack
          } 
        }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`\n🚀 真实 API 测试服务器运行在: http://localhost:${PORT}`);
  console.log('\n测试命令:');
  console.log(`curl -X POST http://localhost:${PORT}/api/video/transcribe-v3 \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer test-api-key-123" \\
  -d '{"mixedText": "看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了"}'`);
});