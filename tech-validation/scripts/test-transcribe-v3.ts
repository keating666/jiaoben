#!/usr/bin/env node
import path from 'path';

import axios from 'axios';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

// 配置
const TEST_CONFIG = {
  // 本地测试
  localUrl: 'http://localhost:3000/api/video/transcribe-v3',
  // Vercel 部署测试
  vercelUrl: 'https://jiaoben.vercel.app/api/video/transcribe-v3',
  
  // 测试数据
  testCases: [
    {
      name: '测试1: 抖音短链接提取',
      data: {
        mixedText: '看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了 #搞笑',
        style: 'humorous',
      },
    },
    {
      name: '测试2: 直接视频URL',
      data: {
        videoUrl: 'https://v.douyin.com/iRyLb8kf/',
        style: 'default',
      },
    },
    {
      name: '测试3: 复杂混合文本',
      data: {
        mixedText: `今天分享一个超级有趣的视频！
        链接在这里👉 https://v.douyin.com/iRyLb8kf/ 
        大家快去看看吧~ 
        #搞笑 #日常 #分享`,
        style: 'professional',
      },
    },
    {
      name: '测试4: 无效输入（应该报错）',
      data: {
        mixedText: '这里没有任何视频链接',
        style: 'default',
      },
    },
  ],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// 打印分隔线
function printSeparator(char = '=', length = 80) {
  console.log(char.repeat(length));
}

// 打印标题
function printTitle(title: string) {
  printSeparator();
  console.log(`${colors.bright}${colors.blue}${title}${colors.reset}`);
  printSeparator();
}

// 打印成功消息
function printSuccess(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

// 打印错误消息
function printError(message: string) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
}

// 打印警告消息
function printWarning(message: string) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// 打印信息
function printInfo(message: string) {
  console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

// 测试单个案例
async function testCase(url: string, testCase: any, apiToken: string) {
  console.log(`\n${colors.bright}${colors.magenta}📝 ${testCase.name}${colors.reset}`);
  console.log('请求数据:', JSON.stringify(testCase.data, null, 2));
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(url, testCase.data, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60秒超时
      validateStatus: () => true, // 接受所有状态码
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n响应状态: ${response.status}`);
    console.log(`响应时间: ${duration}ms`);
    
    if (response.status === 200) {
      printSuccess('请求成功');
      
      const data = response.data;

      if (data.success && data.data) {
        console.log('\n处理结果:');
        console.log(`- 处理时间: ${data.data.processingTime}ms`);
        console.log(`- 原始文本长度: ${data.data.originalText?.length || 0} 字符`);
        console.log(`- 场景数量: ${data.data.script?.scenes?.length || 0}`);
        
        if (data.data.provider) {
          console.log('\n服务提供商:');
          console.log(`- 视频解析: ${data.data.provider.videoResolver}`);
          console.log(`- 音频转文字: ${data.data.provider.transcription}`);
          console.log(`- 脚本生成: ${data.data.provider.scriptGenerator}`);
        }
        
        // 显示前100个字符的文本
        if (data.data.originalText) {
          console.log('\n原始文本预览:');
          console.log(`${data.data.originalText.substring(0, 100)  }...`);
        }
      }
    } else {
      printError(`请求失败 (${response.status})`);
      
      if (response.data.error) {
        console.log('\n错误详情:');
        console.log(`- 错误代码: ${response.data.error.code}`);
        console.log(`- 错误消息: ${response.data.error.message}`);
        console.log(`- 用户消息: ${response.data.error.userMessage}`);
        console.log(`- 可重试: ${response.data.error.retryable ? '是' : '否'}`);
      }
    }
    
  } catch (error: any) {
    const duration = Date.now() - startTime;

    printError(`请求异常 (${duration}ms)`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('无法连接到服务器，请确保服务正在运行');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('请求超时');
    } else {
      console.error('错误:', error.message);
    }
  }
}

// 测试服务状态
async function testServiceStatus(baseUrl: string, apiToken: string) {
  printTitle('服务状态检查');
  
  try {
    const response = await axios.get(`${baseUrl.replace('-v3', '-v3/status')}`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
      },
    });
    
    if (response.status === 200) {
      printSuccess('服务状态正常');
      console.log('\n服务状态:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    printWarning('无法获取服务状态（可能端点未实现）');
  }
}

// 主测试函数
async function runTests() {
  printTitle('Transcribe V3 API 测试工具');
  
  // 检查环境变量
  console.log('\n检查环境变量...');
  
  const requiredEnvVars = [
    'TIKHUB_API_TOKEN',
    'YUNMAO_API_KEY',
    'YUNMAO_API_SECRET',
    'TONGYI_API_KEY',
  ];
  
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  
  if (missingVars.length > 0) {
    printError('缺少必需的环境变量:');
    missingVars.forEach((varName) => console.log(`  - ${varName}`));
    console.log('\n请在 tech-validation/.env 文件中配置这些变量');
    process.exit(1);
  }
  
  printSuccess('所有必需的环境变量已配置');
  
  // 选择测试环境
  const args = process.argv.slice(2);
  const useLocal = args.includes('--local');
  const useVercel = args.includes('--vercel');
  
  if (!useLocal && !useVercel) {
    printInfo('使用 --local 测试本地环境，使用 --vercel 测试部署环境');
    printInfo('默认测试本地环境');
  }
  
  const testUrl = useVercel ? TEST_CONFIG.vercelUrl : TEST_CONFIG.localUrl;
  const testEnv = useVercel ? 'Vercel 部署' : '本地开发';
  
  console.log(`\n测试环境: ${colors.bright}${testEnv}${colors.reset}`);
  console.log(`测试 URL: ${testUrl}`);
  
  // 使用测试 API Token
  const apiToken = process.env.TEST_API_TOKEN || 'test-api-key-123';

  console.log(`API Token: ${apiToken.substring(0, 10)}...`);
  
  // 测试服务状态
  await testServiceStatus(testUrl, apiToken);
  
  // 运行测试案例
  printTitle('开始测试案例');
  
  for (const testCaseItem of TEST_CONFIG.testCases) {
    await testCase(testUrl, testCaseItem, apiToken);
    
    // 添加延迟避免请求过快
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  
  // 总结
  printTitle('测试完成');
  console.log('\n如果测试失败，请检查:');
  console.log('1. 环境变量是否正确配置');
  console.log('2. API 服务是否正常运行');
  console.log('3. 网络连接是否正常');
  console.log('4. API Token 是否有效');
}

// 运行测试
runTests().catch((error) => {
  printError('测试运行失败');
  console.error(error);
  process.exit(1);
});

// 导出配置供其他脚本使用
export { TEST_CONFIG };