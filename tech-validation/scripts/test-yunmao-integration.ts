import dotenv from 'dotenv';
import { YunmaoClient } from '../clients/yunmao-client';
import { TranscriptionProviderManager } from '../services/transcription-provider-manager';

// 加载环境变量
dotenv.config();

/**
 * 测试云猫转码集成
 */
async function testYunmaoIntegration() {
  console.log('=== 云猫转码集成测试 ===\n');

  // 检查配置
  if (!process.env.YUNMAO_API_KEY) {
    console.error('❌ 错误：未配置 YUNMAO_API_KEY');
    console.log('请在 .env 文件中配置云猫转码的 API 密钥');
    return;
  }

  // 测试视频URL
  const testVideos = [
    {
      name: '抖音短视频',
      url: 'https://v.douyin.com/iRyLb8kf/',
      language: 'zh-CN'
    },
    {
      name: 'YouTube视频',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      language: 'en-US'
    }
  ];

  console.log('1. 测试云猫转码客户端直接调用\n');
  
  const client = new YunmaoClient({
    apiKey: process.env.YUNMAO_API_KEY,
    apiSecret: process.env.YUNMAO_API_SECRET
  });

  for (const video of testVideos) {
    console.log(`\n测试视频: ${video.name}`);
    console.log(`URL: ${video.url}`);
    
    try {
      // 创建任务
      console.log('创建转录任务...');
      const task = await client.createExtractTextTask({
        videoUrl: video.url,
        language: video.language,
        outputFormat: 'text'
      });
      
      console.log(`✅ 任务创建成功: ${task.taskId}`);
      console.log(`状态: ${task.status}`);
      
      // 查询任务状态
      console.log('\n查询任务状态...');
      const status = await client.getTaskStatus(task.taskId);
      console.log(`状态: ${status.status}`);
      console.log(`进度: ${status.progress || 0}%`);
      
      // 如果是测试环境，不等待完成
      if (process.env.NODE_ENV === 'test') {
        console.log('⚠️  测试模式，跳过等待任务完成');
        continue;
      }
      
      // 等待任务完成（最多等待2分钟）
      console.log('\n等待任务完成...');
      const result = await client.waitForCompletion(task.taskId, {
        maxWaitTime: 120000, // 2分钟
        pollInterval: 5000,  // 5秒轮询一次
        onProgress: (progress) => {
          process.stdout.write(`\r进度: ${progress}%`);
        }
      });
      
      console.log('\n✅ 转录完成！');
      console.log(`文本长度: ${result.result?.text?.length || 0} 字符`);
      console.log(`字数统计: ${result.result?.wordCount || 0} 字`);
      console.log(`视频时长: ${result.result?.duration || 0} 秒`);
      
      if (result.result?.text) {
        console.log(`\n转录文本预览:`);
        console.log(result.result.text.substring(0, 200) + '...');
      }
      
    } catch (error) {
      console.error(`❌ 测试失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 清理资源
  client.dispose();

  console.log('\n\n2. 测试转录服务管理器\n');
  
  const manager = new TranscriptionProviderManager();
  
  // 显示服务状态
  console.log('服务提供商状态:');
  const status = manager.getStatus();
  for (const [provider, config] of Object.entries(status)) {
    console.log(`- ${provider}: ${config.enabled ? '✅ 启用' : '❌ 禁用'} (优先级: ${config.priority})`);
  }

  // 测试视频转录（使用管理器）
  const testVideo = testVideos[0];
  console.log(`\n测试视频转录: ${testVideo.name}`);
  
  try {
    const result = await manager.transcribe({
      videoUrl: testVideo.url,
      language: testVideo.language,
      options: {
        dialogueMode: false
      }
    });
    
    console.log(`✅ 转录成功！`);
    console.log(`使用的服务: ${result.provider}`);
    console.log(`文本长度: ${result.text.length} 字符`);
    console.log(`处理时间: ${result.metadata?.processingTime || 'N/A'} ms`);
    
    if (result.text) {
      console.log(`\n转录文本预览:`);
      console.log(result.text.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.error(`❌ 转录失败: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 清理资源
  manager.dispose();

  console.log('\n\n3. 测试支持的语言\n');
  
  const languages = YunmaoClient.getSupportedLanguages();
  console.log(`支持 ${languages.length} 种语言:`);
  languages.forEach(lang => {
    console.log(`- ${lang.code}: ${lang.name}`);
  });

  console.log('\n=== 测试完成 ===');
}

// 运行测试
testYunmaoIntegration().catch(console.error);