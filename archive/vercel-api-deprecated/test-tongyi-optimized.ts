import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    console.log('📝 开始测试优化的 Tongyi API...');
    
    // 1. 初始化
    const initStart = Date.now();
    const { TongyiClient } = await import('../tech-validation/utils/tongyi-text-generation');
    const client = new TongyiClient();
    await client.initialize({
      name: 'Tongyi',
      baseUrl: process.env.TONGYI_API_BASE_URL || 'https://dashscope.aliyuncs.com',
      apiKey: process.env.TONGYI_API_KEY!,
      timeout: 30000,
      retryAttempts: 2,
      retryDelay: 1000,
      maxConcurrent: 5,
    });
    const initTime = Date.now() - initStart;
    console.log(`✅ Tongyi 初始化完成: ${initTime}ms`);
    
    // 2. 使用简化的 prompt
    const generateStart = Date.now();
    const simplePrompt = `将以下文字改成3个场景的视频脚本：
大家好，欢迎来到我的抖音视频。今天我要跟大家分享一个非常有趣的内容。

输出JSON格式：
{"title":"视频标题","scenes":[{"scene_number":1,"timestamp":"00:00-00:10","description":"场景描述","dialogue":"对话内容","notes":"拍摄建议"}]}`;

    const result = await client.generateText({
      prompt: simplePrompt,
      model: 'qwen-turbo',
      temperature: 0.7,
      max_tokens: 500, // 减少 token 数量
    });
    
    const generateTime = Date.now() - generateStart;
    console.log(`✅ 脚本生成完成: ${generateTime}ms`);
    
    // 3. 清理
    await client.dispose();
    
    const totalTime = Date.now() - startTime;
    
    res.status(200).json({
      success: true,
      times: {
        initialization: initTime,
        generation: generateTime,
        total: totalTime
      },
      result: {
        responseLength: result.text.length,
        tokensUsed: result.usage?.totalTokens || 0
      },
      message: `优化的 Tongyi API 测试完成，总耗时: ${totalTime}ms`
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('优化的 Tongyi 测试失败:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalTime,
      message: '优化的 Tongyi API 测试失败'
    });
  }
}