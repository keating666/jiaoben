const handler = require('./api/video/transcribe-v3-simple');

// 模拟 Vercel 请求和响应对象
class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.data = null;
  }
  
  status(code) {
    this.statusCode = code;
    return this;
  }
  
  json(data) {
    this.data = data;
    console.log('\n响应状态码:', this.statusCode);
    console.log('响应内容:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
  }
}

// 测试用例
async function testYunmaoIntegration() {
  console.log('🚀 测试云猫 API 集成...\n');
  console.log('环境变量检查:');
  console.log('- YUNMAO_API_KEY:', process.env.YUNMAO_API_KEY ? '✅ 已设置' : '❌ 未设置');
  console.log('- TONGYI_API_KEY:', process.env.TONGYI_API_KEY ? '✅ 已设置' : '❌ 未设置');
  console.log();
  
  const testCases = [
    {
      name: '测试完整流程（抖音链接 → TikHub → 云猫 → 通义）',
      body: {
        videoUrl: 'https://www.douyin.com/video/7234567890123456789',
        style: 'humorous'
      }
    },
    {
      name: '测试混合文本提取',
      body: {
        mixedText: '这个视频真不错 https://www.douyin.com/video/7234567890123456789 大家快看',
        style: 'professional'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n=== ${testCase.name} ===`);
    
    const req = {
      method: 'POST',
      url: '/api/video/transcribe-v3-simple',
      headers: {
        authorization: 'Bearer test-api-key-123'
      },
      body: testCase.body
    };
    
    const res = new MockResponse();
    
    try {
      await handler(req, res);
      
      if (res.data && res.data.success) {
        console.log('\n✅ 测试成功！');
        console.log('使用的服务提供商:', res.data.data.provider);
        console.log('处理时间:', res.data.data.processingTime + 'ms');
        console.log('转录文本长度:', res.data.data.originalText?.length || 0);
        
        // 检查实际使用的服务
        const provider = res.data.data.provider;
        console.log('\n服务使用情况:');
        console.log(`- 视频解析: ${provider.videoResolver} ${provider.videoResolver === 'TikHub' ? '(需要邮箱验证)' : ''}`);
        console.log(`- 视频转文字: ${provider.transcription} ${provider.transcription === 'Yunmao' ? '✅' : '⚠️ 降级到模拟数据'}`);
        console.log(`- 脚本生成: ${provider.scriptGenerator}`);
      } else {
        console.log('\n❌ 测试失败');
        console.log('错误信息:', res.data?.error);
      }
    } catch (error) {
      console.error('\n❌ 处理过程出错:', error.message);
    }
  }
  
  console.log('\n\n=== 说明 ===');
  console.log('- TikHub: 需要邮箱验证才能正常使用');
  console.log('- 云猫转码: 异步API，需要轮询任务状态');
  console.log('- 通义千问: 用于生成分镜头脚本');
  console.log('- 如果某个服务失败，会自动降级到模拟数据');
}

// 运行测试
testYunmaoIntegration();