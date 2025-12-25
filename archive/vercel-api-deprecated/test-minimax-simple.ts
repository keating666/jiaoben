import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    console.log('🎤 开始简化的 MiniMax 测试...');
    
    // 1. 只测试初始化
    const initStart = Date.now();
    const { MiniMaxClientV2 } = await import('../tech-validation/utils/minimax-client-v2');
    const client = new MiniMaxClientV2();
    
    await client.initialize({
      name: 'MiniMax',
      baseUrl: process.env.MINIMAX_API_BASE_URL || 'https://api.minimax.chat/v1',
      apiKey: process.env.MINIMAX_API_KEY!,
      timeout: 20000, // 减少超时时间
      retryAttempts: 1, // 减少重试次数
      retryDelay: 500,
      maxConcurrent: 3,
    });
    
    const initTime = Date.now() - initStart;
    console.log(`✅ MiniMax 初始化完成: ${initTime}ms`);
    
    // 2. 测试 API 连通性（不上传文件）
    const testStart = Date.now();
    // 只返回初始化成功的信息
    const testTime = Date.now() - testStart;
    
    // 3. 清理
    await client.dispose();
    
    const totalTime = Date.now() - startTime;
    
    res.status(200).json({
      success: true,
      times: {
        initialization: initTime,
        test: testTime,
        total: totalTime
      },
      message: `简化的 MiniMax 测试完成，总耗时: ${totalTime}ms`
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('简化的 MiniMax 测试失败:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalTime,
      message: '简化的 MiniMax 测试失败'
    });
  }
}