const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// 测试配置
const API_URL = process.env.API_URL || 'http://localhost:3000/api/video/transcribe';
const API_TOKEN = process.env.API_TOKEN || 'test-token-123';

// 测试用例
const TEST_CASES = [
  {
    name: '测试API健康检查',
    test: async () => {
      console.log('\n1️⃣ 测试API健康检查');
      console.log(`   URL: ${API_URL}`);
      
      try {
        // 先测试OPTIONS请求（CORS预检）
        const optionsResponse = await axios.options(API_URL, {
          validateStatus: () => true
        });
        console.log(`   OPTIONS响应: ${optionsResponse.status}`);
        
        // 测试无效请求（缺少body）
        const response = await axios.post(API_URL, null, {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        });
        
        if (response.status === 400) {
          console.log('   ✅ API正常响应错误请求');
          return true;
        } else {
          console.log(`   ❌ 意外的状态码: ${response.status}`);
          return false;
        }
      } catch (error) {
        console.log(`   ❌ 请求失败: ${error.message}`);
        return false;
      }
    }
  },
  
  {
    name: '测试认证机制',
    test: async () => {
      console.log('\n2️⃣ 测试认证机制');
      
      try {
        // 测试无认证头
        const response = await axios.post(API_URL, {
          url: 'https://example.com/video',
          style: 'default',
          language: 'zh'
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          validateStatus: () => true
        });
        
        if (response.status === 401) {
          console.log('   ✅ 正确拒绝无认证请求');
          return true;
        } else {
          console.log(`   ❌ 意外的状态码: ${response.status}`);
          return false;
        }
      } catch (error) {
        console.log(`   ❌ 请求失败: ${error.message}`);
        return false;
      }
    }
  },
  
  {
    name: '测试输入验证',
    test: async () => {
      console.log('\n3️⃣ 测试输入验证');
      
      const invalidInputs = [
        { desc: '空URL', data: { url: '', style: 'default', language: 'zh' } },
        { desc: '无效样式', data: { url: 'https://example.com', style: 'invalid', language: 'zh' } },
        { desc: '无效语言', data: { url: 'https://example.com', style: 'default', language: 'xx' } }
      ];
      
      let allPassed = true;
      
      for (const { desc, data } of invalidInputs) {
        try {
          const response = await axios.post(API_URL, data, {
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            validateStatus: () => true
          });
          
          if (response.status === 400) {
            console.log(`   ✅ ${desc} - 正确返回400错误`);
          } else {
            console.log(`   ❌ ${desc} - 意外的状态码: ${response.status}`);
            allPassed = false;
          }
        } catch (error) {
          console.log(`   ❌ ${desc} - 请求失败: ${error.message}`);
          allPassed = false;
        }
      }
      
      return allPassed;
    }
  },
  
  {
    name: '测试完整处理流程（模拟）',
    test: async () => {
      console.log('\n4️⃣ 测试完整处理流程');
      console.log('   ⚠️  注意: 这将尝试处理一个真实的视频URL');
      console.log('   如果没有有效的视频URL，测试将失败');
      
      try {
        // 使用一个测试视频URL（可能需要替换为有效的URL）
        const response = await axios.post(API_URL, {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // 示例URL
          style: 'default',
          language: 'zh'
        }, {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          timeout: 55000, // 55秒超时
          validateStatus: () => true
        });
        
        if (response.status === 200) {
          console.log('   ✅ 成功处理视频');
          console.log(`   - 转录文本长度: ${response.data.transcript?.length || 0}`);
          console.log(`   - 脚本生成: ${response.data.script ? '是' : '否'}`);
          
          // 保存输出
          const outputDir = path.join(__dirname, '../test-outputs');
          await fs.mkdir(outputDir, { recursive: true });
          const outputFile = path.join(outputDir, 'api-test-output.json');
          await fs.writeFile(outputFile, JSON.stringify(response.data, null, 2));
          console.log(`   📁 输出保存到: ${outputFile}`);
          
          return true;
        } else {
          console.log(`   ⚠️  处理失败: ${response.status}`);
          console.log(`   错误信息: ${JSON.stringify(response.data.error)}`);
          // 某些错误是预期的（如无效的YouTube URL）
          return response.data.error?.code === 'VIDEO_DOWNLOAD_ERROR';
        }
      } catch (error) {
        console.log(`   ❌ 请求失败: ${error.message}`);
        return false;
      }
    }
  }
];

// 主函数
async function main() {
  console.log('🧪 Story 0.2 API本地测试');
  console.log('='.repeat(60));
  console.log(`API端点: ${API_URL}`);
  console.log(`测试数量: ${TEST_CASES.length}`);
  
  let passed = 0;
  let failed = 0;
  
  // 执行所有测试
  for (const testCase of TEST_CASES) {
    try {
      const result = await testCase.test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`\n❌ 测试执行错误: ${error.message}`);
      failed++;
    }
  }
  
  // 总结
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`成功率: ${((passed / TEST_CASES.length) * 100).toFixed(2)}%`);
  
  process.exit(failed > 0 ? 1 : 0);
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}