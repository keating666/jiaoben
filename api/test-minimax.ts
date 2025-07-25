import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    console.log('🎤 开始测试 MiniMax API...');
    
    // 1. 导入和初始化
    const initStart = Date.now();
    const { AudioTranscriber } = await import('../tech-validation/utils/audio-transcriber');
    const transcriber = new AudioTranscriber();
    await transcriber.initialize();
    const initTime = Date.now() - initStart;
    console.log(`✅ MiniMax 初始化完成: ${initTime}ms`);
    
    // 2. 创建模拟音频
    const audioStart = Date.now();
    const { createMockAudioFile } = await import('../tech-validation/utils/mock-audio');
    const audioPath = '/tmp/test-minimax.mp3';
    await createMockAudioFile(audioPath);
    const audioTime = Date.now() - audioStart;
    console.log(`✅ 模拟音频创建完成: ${audioTime}ms`);
    
    // 3. 调用转写 API
    const transcribeStart = Date.now();
    const result = await transcriber.transcribeAudioFile(audioPath);
    const transcribeTime = Date.now() - transcribeStart;
    console.log(`✅ 音频转写完成: ${transcribeTime}ms`);
    
    // 4. 清理
    await transcriber.dispose();
    
    const totalTime = Date.now() - startTime;
    
    res.status(200).json({
      success: true,
      times: {
        initialization: initTime,
        audioCreation: audioTime,
        transcription: transcribeTime,
        total: totalTime
      },
      result: {
        textLength: result.text.length,
        confidence: result.confidence,
        hasSegments: !!result.segments
      },
      message: `MiniMax API 测试完成，总耗时: ${totalTime}ms`
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('MiniMax 测试失败:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalTime,
      message: 'MiniMax API 测试失败'
    });
  }
}