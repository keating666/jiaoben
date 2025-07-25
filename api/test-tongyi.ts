import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    console.log('📝 开始测试 Tongyi API...');
    
    // 1. 导入和初始化
    const initStart = Date.now();
    const { ScriptGenerator } = await import('../tech-validation/utils/script-generator');
    const generator = new ScriptGenerator();
    await generator.initialize();
    const initTime = Date.now() - initStart;
    console.log(`✅ Tongyi 初始化完成: ${initTime}ms`);
    
    // 2. 准备测试文本
    const { MOCK_TRANSCRIPT } = await import('../tech-validation/utils/mock-audio');
    const testText = MOCK_TRANSCRIPT;
    
    // 3. 调用脚本生成 API
    const generateStart = Date.now();
    const result = await generator.generateScript(testText, {
      style: 'default',
      language: 'zh-CN',
      duration: 30,
      title: '测试视频'
    });
    const generateTime = Date.now() - generateStart;
    console.log(`✅ 脚本生成完成: ${generateTime}ms`);
    
    // 4. 清理
    await generator.dispose();
    
    const totalTime = Date.now() - startTime;
    
    res.status(200).json({
      success: true,
      times: {
        initialization: initTime,
        generation: generateTime,
        total: totalTime
      },
      result: {
        scriptTitle: result.script.title,
        scenesCount: result.script.scenes.length,
        processingTime: result.processingTime
      },
      message: `Tongyi API 测试完成，总耗时: ${totalTime}ms`
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('Tongyi 测试失败:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalTime,
      message: 'Tongyi API 测试失败'
    });
  }
}