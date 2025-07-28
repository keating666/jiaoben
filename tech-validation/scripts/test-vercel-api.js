const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Vercel部署的API端点（需要根据实际部署URL更新）
const VERCEL_API_URL = 'https://jiaoben.vercel.app/api/video/transcribe';
const API_TOKEN = 'test-token-123'; // 测试用token

console.log('🧪 Story 0.2 Vercel API测试');
console.log('='.repeat(60));
console.log(`API端点: ${VERCEL_API_URL}`);
console.log(`开始时间: ${new Date().toISOString()}\n`);

// 测试1: API健康检查
async function testHealthCheck() {
  console.log('1️⃣ 测试API健康检查');
  
  try {
    // 测试错误的请求（无body）
    const response = await axios.post(VERCEL_API_URL, null, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });
    
    console.log(`   状态码: ${response.status}`);
    if (response.status === 400) {
      console.log('   ✅ API正常响应（拒绝无效请求）');
      return true;
    } else {
      console.log(`   ❌ 意外的响应: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return false;
  }
}

// 测试2: 认证测试
async function testAuthentication() {
  console.log('\n2️⃣ 测试认证机制');
  
  try {
    // 无认证头的请求
    const response = await axios.post(VERCEL_API_URL, {
      url: 'https://example.com/video',
      style: 'default',
      language: 'zh'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      validateStatus: () => true
    });
    
    console.log(`   状态码: ${response.status}`);
    if (response.status === 401) {
      console.log('   ✅ 正确拒绝无认证请求');
      return true;
    } else {
      console.log(`   ❌ 意外的响应`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return false;
  }
}

// 测试3: 输入验证
async function testInputValidation() {
  console.log('\n3️⃣ 测试输入验证');
  
  const testCases = [
    { name: '空URL', data: { url: '', style: 'default', language: 'zh' } },
    { name: '无效样式', data: { url: 'https://test.com', style: 'invalid', language: 'zh' } },
    { name: '无效语言', data: { url: 'https://test.com', style: 'default', language: 'xx' } },
    { name: 'SSRF测试', data: { url: 'http://localhost:3000/admin', style: 'default', language: 'zh' } }
  ];
  
  let passed = 0;
  
  for (const { name, data } of testCases) {
    try {
      const response = await axios.post(VERCEL_API_URL, data, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      });
      
      if (response.status === 400 || response.status === 403) {
        console.log(`   ✅ ${name} - 正确拒绝（${response.status}）`);
        passed++;
      } else {
        console.log(`   ❌ ${name} - 意外状态码: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${name} - 请求失败: ${error.message}`);
    }
  }
  
  return passed === testCases.length;
}

// 测试4: 错误处理测试
async function testErrorHandling() {
  console.log('\n4️⃣ 测试错误处理');
  
  try {
    // 使用一个无效的视频URL
    const response = await axios.post(VERCEL_API_URL, {
      url: 'https://not-a-video-site.com/video123',
      style: 'default',
      language: 'zh'
    }, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000,
      validateStatus: () => true
    });
    
    console.log(`   状态码: ${response.status}`);
    
    if (response.status === 500 && response.data.error) {
      console.log(`   ✅ 正确返回错误信息`);
      console.log(`   错误码: ${response.data.error.code}`);
      console.log(`   错误消息: ${response.data.error.message}`);
      return true;
    } else {
      console.log(`   ❌ 意外的响应`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return false;
  }
}

// 测试5: 性能测试（简单版）
async function testPerformance() {
  console.log('\n5️⃣ 测试API响应时间');
  
  const startTime = Date.now();
  
  try {
    // 发送一个会快速失败的请求
    const response = await axios.post(VERCEL_API_URL, {
      url: 'https://invalid-url',
      style: 'default', 
      language: 'zh'
    }, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000,
      validateStatus: () => true
    });
    
    const responseTime = Date.now() - startTime;
    console.log(`   响应时间: ${responseTime}ms`);
    
    if (responseTime < 3000) {
      console.log('   ✅ 响应时间合理');
      return true;
    } else {
      console.log('   ⚠️  响应时间较长');
      return true; // 不算失败
    }
  } catch (error) {
    console.log(`   ❌ 请求失败: ${error.message}`);
    return false;
  }
}

// 主测试函数
async function runTests() {
  const tests = [
    { name: 'API健康检查', fn: testHealthCheck },
    { name: '认证机制', fn: testAuthentication },
    { name: '输入验证', fn: testInputValidation },
    { name: '错误处理', fn: testErrorHandling },
    { name: '性能测试', fn: testPerformance }
  ];
  
  const results = {
    total: tests.length,
    passed: 0,
    failed: 0
  };
  
  for (const test of tests) {
    try {
      const passed = await test.fn();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.log(`\n❌ ${test.name} - 执行错误: ${error.message}`);
      results.failed++;
    }
  }
  
  // 测试报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试报告');
  console.log('='.repeat(60));
  console.log(`总测试数: ${results.total}`);
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`成功率: ${((results.passed / results.total) * 100).toFixed(2)}%`);
  console.log(`\n完成时间: ${new Date().toISOString()}`);
  
  // 保存报告
  const reportDir = path.join(__dirname, '../test-outputs');
  await fs.mkdir(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `vercel-api-test-${Date.now()}.json`);
  
  await fs.writeFile(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    endpoint: VERCEL_API_URL,
    results: results,
    details: '查看控制台输出了解详细信息'
  }, null, 2));
  
  console.log(`\n📁 报告已保存到: ${reportFile}`);
  
  return results.failed === 0;
}

// 执行测试
runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});