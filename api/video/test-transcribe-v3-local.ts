// 本地测试脚本 - 模拟 Vercel 环境
import { createServer } from 'http';
import handler from './transcribe-v3';
import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../tech-validation/.env') });

// 模拟 VercelRequest 和 VercelResponse
function createMockRequest(body: any, headers: any = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body,
    url: '/api/video/transcribe-v3',
    query: {},
    cookies: {}
  } as VercelRequest;
}

function createMockResponse(): VercelResponse & { data?: any; statusCode?: number } {
  let responseData: any;
  let statusCode = 200;
  
  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      res.data = data;
      res.statusCode = statusCode;
      console.log(`\nResponse (${statusCode}):`, JSON.stringify(data, null, 2));
      return res;
    },
    setHeader: () => res,
    end: () => res
  };
  
  return res;
}

// 测试服务器
const server = createServer(async (req, res) => {
  if (req.url === '/api/video/transcribe-v3' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parsedBody = JSON.parse(body);
        const mockReq = createMockRequest(parsedBody, req.headers);
        const mockRes = createMockResponse();
        
        await handler(mockReq, mockRes);
        
        res.writeHead(mockRes.statusCode || 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockRes.data));
      } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Transcribe V3 测试服务器运行在: http://localhost:${PORT}`);
  console.log('\n环境变量检查:');
  console.log('- TIKHUB_API_TOKEN:', process.env.TIKHUB_API_TOKEN ? '✅ 已设置' : '❌ 未设置');
  console.log('- YUNMAO_API_KEY:', process.env.YUNMAO_API_KEY ? '✅ 已设置' : '❌ 未设置');
  console.log('- YUNMAO_API_SECRET:', process.env.YUNMAO_API_SECRET ? '✅ 已设置' : '❌ 未设置');
  console.log('- TONGYI_API_KEY:', process.env.TONGYI_API_KEY ? '✅ 已设置' : '❌ 未设置');
  
  console.log('\n使用以下命令测试:');
  console.log(`curl -X POST http://localhost:${PORT}/api/video/transcribe-v3 \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer test-api-key-123" \\
  -d '{"mixedText": "看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了"}'`);
});