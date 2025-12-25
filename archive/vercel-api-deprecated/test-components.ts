import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results = {
    env: false,
    replit: false,
    minimax: false,
    tongyi: false,
    mockAudio: false
  };

  try {
    // 1. 检查环境变量
    results.env = !!(
      process.env.MINIMAX_API_KEY &&
      process.env.MINIMAX_GROUP_ID &&
      process.env.TONGYI_API_KEY &&
      process.env.REPLIT_VIDEO_SERVICE_URL
    );

    // 2. 测试 Replit 服务
    if (process.env.REPLIT_VIDEO_SERVICE_URL) {
      try {
        const response = await fetch(`${process.env.REPLIT_VIDEO_SERVICE_URL}/health`);
        const data = await response.json();
        results.replit = (data.status === 'ok' || data.status === 'healthy') && !!data.ffmpeg;
      } catch (e) {
        console.error('Replit 测试失败:', e);
      }
    }

    // 3. 创建模拟音频
    try {
      const { createMockAudioFile } = await import('../tech-validation/utils/mock-audio');
      const testPath = '/tmp/test-audio.mp3';
      await createMockAudioFile(testPath);
      results.mockAudio = true;
    } catch (e) {
      console.error('模拟音频创建失败:', e);
    }

    // 4. 测试 MiniMax 初始化
    try {
      const { AudioTranscriber } = await import('../tech-validation/utils/audio-transcriber');
      const transcriber = new AudioTranscriber();
      await transcriber.initialize();
      results.minimax = true;
      await transcriber.dispose();
    } catch (e) {
      console.error('MiniMax 初始化失败:', e);
    }

    // 5. 测试 Tongyi 初始化
    try {
      const { ScriptGenerator } = await import('../tech-validation/utils/script-generator');
      const generator = new ScriptGenerator();
      await generator.initialize();
      results.tongyi = true;
      await generator.dispose();
    } catch (e) {
      console.error('Tongyi 初始化失败:', e);
    }

    const allPassed = Object.values(results).every(v => v === true);

    res.status(200).json({
      success: allPassed,
      tests: results,
      message: allPassed ? '✅ 所有组件测试通过' : '❌ 部分组件测试失败',
      recommendation: !results.replit ? 
        '建议：Replit 服务不可用，但可以使用模拟数据继续测试' : 
        '所有服务正常'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}