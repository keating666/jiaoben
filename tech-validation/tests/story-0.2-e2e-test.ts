import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

// 测试配置
const TEST_CONFIG = {
  apiEndpoint: process.env.API_ENDPOINT || 'http://localhost:3000/api/video/transcribe',
  apiToken: process.env.TEST_API_TOKEN || 'test-token-123',
  outputDir: path.join(__dirname, 'test-outputs'),
  timeout: 55000 // 55秒超时（低于Vercel的60秒限制）
};

// 测试用例
const TEST_CASES = [
  {
    name: '正常抖音视频链接测试',
    description: '测试标准抖音短链接的完整处理流程',
    input: {
      url: 'https://v.douyin.com/iRyBWfGS/',
      style: 'default',
      language: 'zh'
    },
    expectations: {
      hasTranscript: true,
      hasScript: true,
      scriptSections: ['introduction', 'scenes', 'conclusion']
    }
  },
  {
    name: '错误的视频URL测试',
    description: '测试无效URL的错误处理',
    input: {
      url: 'https://invalid-url.com/video',
      style: 'default',
      language: 'zh'
    },
    expectations: {
      shouldFail: true,
      errorCode: 'VIDEO_DOWNLOAD_ERROR'
    }
  },
  {
    name: '缺少API Token测试',
    description: '测试认证错误处理',
    input: {
      url: 'https://v.douyin.com/test/',
      style: 'default',
      language: 'zh'
    },
    skipAuth: true,
    expectations: {
      shouldFail: true,
      errorCode: 'UNAUTHORIZED'
    }
  }
];

// 测试执行函数
async function runE2ETest() {
  console.log('🧪 Story 0.2 端到端测试开始\n');
  console.log(`API端点: ${TEST_CONFIG.apiEndpoint}`);
  console.log(`测试用例数: ${TEST_CASES.length}\n`);

  // 创建输出目录
  await fs.mkdir(TEST_CONFIG.outputDir, { recursive: true });

  const results = {
    total: TEST_CASES.length,
    passed: 0,
    failed: 0,
    details: [] as any[]
  };

  // 执行每个测试用例
  for (const testCase of TEST_CASES) {
    console.log(`\n📋 执行测试: ${testCase.name}`);
    console.log(`   描述: ${testCase.description}`);
    
    const startTime = Date.now();
    let testResult: any = {
      name: testCase.name,
      status: 'PENDING',
      duration: 0,
      error: null,
      response: null
    };

    try {
      // 准备请求头
      const headers: any = {
        'Content-Type': 'application/json'
      };
      
      if (!testCase.skipAuth) {
        headers['Authorization'] = `Bearer ${TEST_CONFIG.apiToken}`;
      }

      // 发送请求
      console.log(`   发送请求到: ${TEST_CONFIG.apiEndpoint}`);
      const response = await axios.post(
        TEST_CONFIG.apiEndpoint,
        testCase.input,
        {
          headers,
          timeout: TEST_CONFIG.timeout,
          validateStatus: () => true // 接受所有状态码
        }
      );

      testResult.response = {
        status: response.status,
        data: response.data
      };
      testResult.duration = Date.now() - startTime;

      // 验证响应
      if (testCase.expectations.shouldFail) {
        // 期望失败的测试
        if (response.status >= 400) {
          if (testCase.expectations.errorCode && 
              response.data.error?.code === testCase.expectations.errorCode) {
            testResult.status = 'PASSED';
            console.log(`   ✅ 测试通过 - 正确返回错误码: ${testCase.expectations.errorCode}`);
          } else {
            testResult.status = 'FAILED';
            testResult.error = `期望错误码 ${testCase.expectations.errorCode}, 实际返回 ${response.data.error?.code}`;
            console.log(`   ❌ 测试失败 - ${testResult.error}`);
          }
        } else {
          testResult.status = 'FAILED';
          testResult.error = '期望请求失败，但请求成功了';
          console.log(`   ❌ 测试失败 - ${testResult.error}`);
        }
      } else {
        // 期望成功的测试
        if (response.status === 200) {
          const data = response.data;
          let allChecksPassed = true;
          
          // 检查必需字段
          if (testCase.expectations.hasTranscript && !data.transcript) {
            allChecksPassed = false;
            testResult.error = '响应缺少transcript字段';
          }
          
          if (testCase.expectations.hasScript && !data.script) {
            allChecksPassed = false;
            testResult.error = '响应缺少script字段';
          }
          
          // 检查脚本结构
          if (testCase.expectations.scriptSections && data.script) {
            for (const section of testCase.expectations.scriptSections) {
              if (!data.script[section]) {
                allChecksPassed = false;
                testResult.error = `脚本缺少必需的部分: ${section}`;
                break;
              }
            }
          }
          
          if (allChecksPassed) {
            testResult.status = 'PASSED';
            console.log(`   ✅ 测试通过 - 耗时: ${testResult.duration}ms`);
            
            // 保存成功的输出
            const outputFile = path.join(
              TEST_CONFIG.outputDir,
              `${testCase.name.replace(/[^a-z0-9]/gi, '_')}_output.json`
            );
            await fs.writeFile(outputFile, JSON.stringify(data, null, 2));
            console.log(`   📁 输出已保存到: ${outputFile}`);
          } else {
            testResult.status = 'FAILED';
            console.log(`   ❌ 测试失败 - ${testResult.error}`);
          }
        } else {
          testResult.status = 'FAILED';
          testResult.error = `请求失败，状态码: ${response.status}`;
          console.log(`   ❌ 测试失败 - ${testResult.error}`);
        }
      }
    } catch (error: any) {
      testResult.status = 'FAILED';
      testResult.duration = Date.now() - startTime;
      testResult.error = error.message;
      console.log(`   ❌ 测试异常 - ${error.message}`);
    }

    // 更新统计
    if (testResult.status === 'PASSED') {
      results.passed++;
    } else {
      results.failed++;
    }
    
    results.details.push(testResult);
  }

  // 生成测试报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试报告总结');
  console.log('='.repeat(60));
  console.log(`总测试数: ${results.total}`);
  console.log(`✅ 通过: ${results.passed}`);
  console.log(`❌ 失败: ${results.failed}`);
  console.log(`成功率: ${((results.passed / results.total) * 100).toFixed(2)}%`);
  
  // 保存详细报告
  const reportPath = path.join(TEST_CONFIG.outputDir, 'test-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 详细报告已保存到: ${reportPath}`);
  
  // 性能分析
  const successfulTests = results.details.filter(r => r.status === 'PASSED' && !r.response?.data?.error);
  if (successfulTests.length > 0) {
    const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
    console.log(`\n⏱️  平均响应时间: ${avgDuration.toFixed(0)}ms`);
  }
  
  return results;
}

// 主函数
async function main() {
  try {
    console.log('🚀 Story 0.2 端到端测试套件');
    console.log('='.repeat(60));
    
    // 检查环境
    if (!process.env.API_ENDPOINT) {
      console.log('⚠️  警告: 未设置API_ENDPOINT，使用默认值: http://localhost:3000/api/video/transcribe');
    }
    
    // 运行测试
    const results = await runE2ETest();
    
    // 退出码
    process.exit(results.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

export { runE2ETest, TEST_CASES, TEST_CONFIG };