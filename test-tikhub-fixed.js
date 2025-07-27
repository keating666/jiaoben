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
async function testTikHubIntegration() {
  console.log('🚀 测试修复后的 TikHub API 集成...\n');
  
  const testCases = [
    {
      name: '测试短链接（预期失败）',
      body: {
        mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太搞笑了',
        style: 'humorous'
      }
    },
    {
      name: '测试长链接（如果有真实视频ID）',
      body: {
        videoUrl: 'https://www.douyin.com/video/7234567890123456789',
        style: 'default'
      }
    },
    {
      name: '测试包含aweme_id的链接',
      body: {
        videoUrl: 'https://www.douyin.com/discover?modal_id=7234567890123456789',
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
      } else {
        console.log('\n❌ 测试失败');
        console.log('错误信息:', res.data?.error);
      }
    } catch (error) {
      console.error('\n❌ 处理过程出错:', error.message);
    }
  }
  
  console.log('\n\n=== 说明 ===');
  console.log('- 短链接需要先重定向获取真实视频ID，目前暂不支持');
  console.log('- 长链接格式：https://www.douyin.com/video/[19位数字ID]');
  console.log('- 可以从抖音网页版获取长链接进行测试');
}

// 运行测试
testTikHubIntegration();