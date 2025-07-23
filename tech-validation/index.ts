// 技术验证项目入口文件
export function handler(req: any, res: any) {
  res.status(200).json({
    message: 'Tech Validation API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: [
      '/api/health - Health check',
      '/api/test/minimax - MiniMax API test', 
      '/api/test/tongyi - Tongyi API test'
    ]
  });
}

// 默认导出
export default handler;