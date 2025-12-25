import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  try {
    console.log('🎭 开始完全模拟测试...');
    
    // 1. 模拟链接提取
    const linkStart = Date.now();
    const videoUrl = 'https://v.douyin.com/mock-test';
    const linkTime = Date.now() - linkStart;
    
    // 2. 模拟视频元数据
    const metadataStart = Date.now();
    const metadata = {
      duration: 30,
      title: '模拟测试视频',
      format: 'mp4',
      url: videoUrl
    };
    const metadataTime = Date.now() - metadataStart;
    
    // 3. 模拟音频创建
    const audioStart = Date.now();
    const audioPath = '/tmp/mock-audio.mp3';
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    const audioTime = Date.now() - audioStart;
    
    // 4. 模拟转写结果
    const transcribeStart = Date.now();
    const { MOCK_TRANSCRIPT } = await import('../tech-validation/utils/mock-audio');
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 200));
    const transcribeTime = Date.now() - transcribeStart;
    
    // 5. 模拟脚本生成
    const scriptStart = Date.now();
    const script = {
      title: '模拟视频脚本',
      duration: 30,
      scenes: [
        {
          scene_number: 1,
          timestamp: '00:00-00:10',
          description: '开场画面',
          dialogue: '大家好，欢迎来到我的抖音视频',
          notes: '欢快的背景音乐'
        },
        {
          scene_number: 2,
          timestamp: '00:10-00:20',
          description: '主要内容',
          dialogue: '今天我要跟大家分享一个非常有趣的内容',
          notes: '展示核心内容'
        },
        {
          scene_number: 3,
          timestamp: '00:20-00:30',
          description: '结尾',
          dialogue: '希望大家喜欢这个视频，记得点赞关注哦',
          notes: '呼吁互动'
        }
      ]
    };
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 150));
    const scriptTime = Date.now() - scriptStart;
    
    const totalTime = Date.now() - startTime;
    
    res.status(200).json({
      success: true,
      times: {
        linkExtraction: linkTime,
        metadata: metadataTime,
        audioCreation: audioTime,
        transcription: transcribeTime,
        scriptGeneration: scriptTime,
        total: totalTime
      },
      data: {
        original_text: MOCK_TRANSCRIPT,
        script: script,
        processing_time: totalTime
      },
      message: `完全模拟测试完成，总耗时: ${totalTime}ms`
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('模拟测试失败:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      totalTime,
      message: '模拟测试失败'
    });
  }
}