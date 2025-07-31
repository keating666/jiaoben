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
    console.log('响应内容:', JSON.stringify(data, null, 2));
  }
}

// 测试用例
async function testTikHubIntegration() {
  console.log('🚀 测试 TikHub API 集成...\n');
  
  const testCases = [
    {
      name: '测试抖音短链接',
      body: {
        mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太搞笑了',
        style: 'humorous'
      }
    },
    {
      name: '测试直接视频链接',
      body: {
        videoUrl: 'https://v.douyin.com/iRyLb8kf/',
        style: 'default'
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
        
        // 检查是否真的调用了 TikHub
        if (res.data.data.provider.videoResolver === 'TikHub') {
          console.log('✅ 成功使用 TikHub 解析视频地址');
        } else {
          console.log('⚠️  未使用 TikHub，可能降级到直接链接');
        }
      } else {
        console.log('\n❌ 测试失败');
        console.log('错误信息:', res.data?.error);
      }
    } catch (error) {
      console.error('\n❌ 处理过程出错:', error.message);
    }
  }
  
  console.log('\n测试完成！');
}

// 检查环境变量
function checkEnvVars() {
  console.log('环境变量检查:');
  console.log('- TIKHUB_API_TOKEN:', process.env.TIKHUB_API_TOKEN ? '✅ 已设置' : '❌ 未设置');
  console.log('- TONGYI_API_KEY:', process.env.TONGYI_API_KEY ? '✅ 已设置' : '❌ 未设置');
  console.log();
}

// 运行测试
checkEnvVars();
testTikHubIntegration();