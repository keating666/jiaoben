#!/usr/bin/env node

const express = require('express');
const app = express();
const port = 3000;

// 中间件
app.use(express.json());

// 导入 API 处理函数
const videoTranscribe = require('../api/video/transcribe.ts').default;

// API 健康检查
app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

// 视频转录端点
app.post('/api/video/transcribe', async (req, res) => {
  try {
    // 模拟 Vercel 的请求和响应对象
    const vercelReq = {
      method: req.method,
      headers: req.headers,
      body: req.body,
      query: req.query
    };
    
    const vercelRes = {
      status: (code) => {
        res.status(code);
        return {
          json: (data) => res.json(data)
        };
      },
      json: (data) => res.json(data)
    };
    
    // 调用实际的处理函数
    await videoTranscribe(vercelReq, vercelRes);
  } catch (error) {
    console.error('处理请求时出错:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`🚀 开发服务器已启动: http://localhost:${port}`);
  console.log(`📡 API 端点: http://localhost:${port}/api`);
  console.log(`🎬 视频转录: POST http://localhost:${port}/api/video/transcribe`);
  console.log('\n按 Ctrl+C 停止服务器');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  process.exit(0);
});