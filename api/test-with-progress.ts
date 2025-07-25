import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const logs: string[] = [];
  
  const log = (message: string) => {
    const time = Date.now() - startTime;
    const logMessage = `[${time}ms] ${message}`;
    console.log(logMessage);
    logs.push(logMessage);
  };
  
  try {
    log('🚀 开始完整流程测试（带进度跟踪）');
    
    // 1. 链接提取（模拟）
    log('📎 提取视频链接...');
    const videoUrl = 'https://v.douyin.com/test';
    
    // 2. 视频元数据（模拟）
    log('📹 获取视频元数据...');
    const metadata = {
      duration: 30,
      title: '测试视频',
      format: 'mp4',
      url: videoUrl
    };
    
    // 3. MiniMax 转写（使用模拟数据避免超时）
    log('🎤 初始化 MiniMax...');
    const { MOCK_TRANSCRIPT } = await import('../tech-validation/utils/mock-audio');
    log('✅ 使用模拟转写结果（避免音频上传超时）');
    
    // 4. Tongyi 脚本生成（优化版）
    log('📝 初始化 Tongyi...');
    const { TongyiClient } = await import('../tech-validation/utils/tongyi-text-generation');
    const tongyiClient = new TongyiClient();
    
    await tongyiClient.initialize({
      name: 'Tongyi',
      baseUrl: process.env.TONGYI_API_BASE_URL || 'https://dashscope.aliyuncs.com',
      apiKey: process.env.TONGYI_API_KEY!,
      timeout: 30000,
      retryAttempts: 1,
      retryDelay: 500,
      maxConcurrent: 5,
    });
    
    log('🎬 生成脚本（优化版）...');
    const simplePrompt = `将以下文字改成3个场景的视频脚本：
${MOCK_TRANSCRIPT.slice(0, 100)}...

输出JSON格式：
{"title":"视频标题","scenes":[{"scene_number":1,"timestamp":"00:00-00:10","description":"场景描述","dialogue":"对话内容","notes":"拍摄建议"}]}`;

    const scriptResult = await tongyiClient.generateScript({
      prompt: simplePrompt,
      model: 'qwen-turbo',
      temperature: 0.7,
      maxTokens: 300, // 进一步减少
    });
    
    log('✅ 脚本生成完成');
    
    // 5. 清理
    await tongyiClient.dispose();
    
    const totalTime = Date.now() - startTime;
    log(`🎉 完整流程完成，总耗时: ${totalTime}ms`);
    
    res.status(200).json({
      success: true,
      totalTime,
      logs,
      result: {
        transcriptLength: MOCK_TRANSCRIPT.length,
        scriptLength: scriptResult.text.length,
        message: '完整流程测试完成（使用优化策略）'
      }
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    log(`❌ 测试失败: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalTime,
      logs,
      message: '完整流程测试失败'
    });
  }
}