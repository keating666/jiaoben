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
    if (data.success) {
      console.log('响应内容:');
      console.log('- 原始文本:', data.data.originalText?.substring(0, 100) + '...');
      console.log('- 脚本场景数:', data.data.script?.scenes?.length || 0);
      console.log('- 处理时间:', data.data.processingTime + 'ms');
      console.log('- 服务提供商:', JSON.stringify(data.data.provider));
    } else {
      console.log('错误响应:', data);
    }
  }
}

// 测试用例
async function testYunmaoFixed() {
  console.log('🚀 测试修正后的云猫（广帆）API 集成...\n');
  console.log('环境变量检查:');
  console.log('- YUNMAO_API_KEY:', process.env.YUNMAO_API_KEY ? '✅ 已设置' : '❌ 未设置');
  console.log('- TONGYI_API_KEY:', process.env.TONGYI_API_KEY ? '✅ 已设置' : '❌ 未设置');
  console.log();
  
  console.log('API 信息:');
  console.log('- 云猫（广帆）API 地址: https://api.guangfan.tech/v1/get-text');
  console.log('- 使用回调通知模式');
  console.log('- 当前使用模拟等待（生产环境需实现回调端点）');
  console.log();
  
  const testCase = {
    name: '测试云猫转文字功能',
    body: {
      videoUrl: 'https://www.example.com/test-video.mp4',
      style: 'professional'
    }
  };
  
  console.log(`=== ${testCase.name} ===`);
  console.log('测试视频URL:', testCase.body.videoUrl);
  console.log('脚本风格:', testCase.body.style);
  console.log();
  
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
    console.log('开始处理请求...\n');
    await handler(req, res);
    
    if (res.data && res.data.success) {
      console.log('\n✅ 测试成功！');
      
      // 检查服务使用情况
      const provider = res.data.data.provider;
      console.log('\n服务集成状态:');
      if (provider.transcription === 'Yunmao') {
        console.log('✅ 云猫 API 集成成功');
        console.log('   注意：当前使用模拟等待，需要实现回调端点才能接收真实结果');
      } else if (provider.transcription === 'Mock') {
        console.log('⚠️  云猫 API 调用失败，降级到模拟数据');
      }
    } else {
      console.log('\n❌ 测试失败');
    }
  } catch (error) {
    console.error('\n❌ 处理过程出错:', error.message);
  }
  
  console.log('\n\n=== 云猫（广帆）API 集成说明 ===');
  console.log('1. API 使用异步处理模式，需要提供回调地址');
  console.log('2. 当前实现使用模拟等待，实际应用需要:');
  console.log('   - 创建 /api/yunmao-callback 端点接收回调');
  console.log('   - 使用数据库或缓存存储任务状态');
  console.log('   - 实现任务ID与结果的关联查询');
  console.log('3. API 支持多种语言和对话模式');
  console.log('4. 处理时间通常为30-60秒');
}

// 运行测试
testYunmaoFixed();