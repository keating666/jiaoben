#!/usr/bin/env ts-node

import { MiniMaxClient } from './minimax-speech-to-text';
import { TongyiClient } from './tongyi-text-generation';
import { IPDiagnosisService, IPDiagnosisInput } from './ip-diagnosis';
import { checkAudioFiles } from './check-audio-files';
import { Config } from '../utils/config';
import { logger, LogLevel } from '../utils/logger';

/**
 * 综合测试结果接口
 */
interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  details: any;
  error?: string;
}

/**
 * 综合测试套件
 */
class ComprehensiveTestSuite {
  private testResults: TestResult[] = [];

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('\\n🚀 开始运行完整的端到端测试流程\\n');
    console.log('='.repeat(60));

    // 1. 环境验证测试
    await this.runTest('环境配置验证', async () => {
      return this.testEnvironmentSetup();
    });

    // 2. 音频文件检查测试
    await this.runTest('测试音频文件检查', async () => {
      return await checkAudioFiles();
    });

    // 3. MiniMax API测试
    await this.runTest('MiniMax API集成验证', async () => {
      return await this.testMiniMaxAPI();
    });

    // 4. 通义千问API测试
    await this.runTest('通义千问API集成验证', async () => {
      return await this.testTongyiAPI();
    });

    // 5. IP诊断服务测试
    await this.runTest('IP诊断服务验证', async () => {
      return await this.testIPDiagnosisService();
    });

    // 6. 性能基准测试
    await this.runTest('性能基准测试', async () => {
      return await this.testPerformanceBenchmarks();
    });

    // 7. 错误处理测试
    await this.runTest('错误处理机制测试', async () => {
      return await this.testErrorHandling();
    });

    console.log('\\n' + '='.repeat(60));
    console.log('🏁 所有测试完成，生成测试报告\\n');

    this.generateTestReport();
    return this.testResults;
  }

  /**
   * 运行单个测试
   */
  private async runTest(testName: string, testFunction: () => Promise<any>): Promise<void> {
    console.log(`\\n📋 ${testName}...`);
    const startTime = Date.now();

    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;

      this.testResults.push({
        testName,
        success: true,
        duration,
        details: result
      });

      console.log(`✅ ${testName} - 成功 (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.testResults.push({
        testName,
        success: false,
        duration,
        details: null,
        error: error.message
      });

      console.log(`❌ ${testName} - 失败 (${duration}ms): ${error.message}`);
      logger.error('ComprehensiveTest', testName, '测试失败', error);
    }
  }

  /**
   * 测试环境配置
   */
  private testEnvironmentSetup(): any {
    const validation = Config.validateEnv();
    const appConfig = Config.getAppConfig();

    if (!validation.valid) {
      throw new Error(`环境变量验证失败，缺失: ${validation.missing.join(', ')}`);
    }

    return {
      environmentValid: validation.valid,
      missingVars: validation.missing,
      nodeEnv: appConfig.nodeEnv,
      logLevel: appConfig.logLevel,
      apiTimeout: appConfig.apiTimeout,
      maxRetries: appConfig.maxRetries
    };
  }

  /**
   * 测试MiniMax API
   */
  private async testMiniMaxAPI(): Promise<any> {
    const client = new MiniMaxClient();
    const config = Config.getMiniMaxConfig();
    await client.initialize(config);

    // 健康检查
    const healthCheck = await client.healthCheck();

    // 文本生成测试
    const textGenResult = await client.generateText({
      prompt: '请简要介绍人工智能技术',
      max_tokens: 100,
      temperature: 0.5
    });

    // 模拟语音转文字测试
    const mockAudioBuffer = Buffer.from('mock audio data for testing');
    const sttResult = await client.speechToText({
      audioFile: mockAudioBuffer,
      language: 'zh-CN',
      format: 'mp3'
    });

    return {
      healthCheck,
      textGeneration: {
        success: !!textGenResult.text,
        textLength: textGenResult.text.length,
        model: textGenResult.model
      },
      speechToText: {
        success: !!sttResult.text,
        textLength: sttResult.text.length,
        confidence: sttResult.confidence,
        isSimulated: sttResult.text.includes('[模拟]')
      }
    };
  }

  /**
   * 测试通义千问API
   */
  private async testTongyiAPI(): Promise<any> {
    const client = new TongyiClient();
    const config = Config.getTongyiConfig();
    await client.initialize(config);

    // 健康检查
    const healthCheck = await client.healthCheck();

    // 基础文本生成
    const basicTextResult = await client.generateText({
      prompt: '请用50字介绍短视频营销的重要性',
      max_tokens: 100,
      temperature: 0.6
    });

    // 短视频脚本仿写
    const originalScript = '今天分享一个超实用的Excel技巧，数据透视表3步骤：选择数据、插入透视表、拖拽字段。学会了工作效率提升10倍！';
    const rewriteResult = await client.rewriteVideoScript(originalScript, 'educational', 30);

    return {
      healthCheck,
      basicTextGeneration: {
        success: !!basicTextResult.text,
        textLength: basicTextResult.text.length,
        model: basicTextResult.model
      },
      scriptRewriting: {
        success: !!rewriteResult.text,
        originalLength: originalScript.length,
        rewriteLength: rewriteResult.text.length,
        style: 'educational'
      }
    };
  }

  /**
   * 测试IP诊断服务
   */
  private async testIPDiagnosisService(): Promise<any> {
    const service = new IPDiagnosisService();
    await service.initialize();

    const testInput: IPDiagnosisInput = {
      gender: '男',
      age: 28,
      profession: '产品经理',
      industry: '互联网',
      experience: '5年产品经验，专注SaaS产品',
      targetAudience: '中小企业的业务负责人',
      audiencePain: '产品功能复杂，用户上手困难，留存率低',
      businessGoal: '提供产品咨询和培训服务，年收入目标50万'
    };

    const report = await service.generateDiagnosisReport(testInput);
    const formattedReport = service.formatReport(report);

    // 验证报告完整性
    const completeness = {
      hasBasicInfo: !!report.basicInfo.summary,
      hasTargetAudience: !!report.basicInfo.targetAudience,
      hasIPPositioning: !!report.positioningAndExecution.ipPositioning,
      hasContentTopics: !!report.contentTopics.competitiveTopics,
      hasAdvice: !!report.additionalAdvice.contentStrategy
    };

    const allSectionsComplete = Object.values(completeness).every(Boolean);

    return {
      reportGeneration: {
        success: allSectionsComplete,
        reportLength: formattedReport.length,
        ipPositioning: report.positioningAndExecution.ipPositioning
      },
      completeness,
      testProfile: {
        profession: testInput.profession,
        industry: testInput.industry,
        age: testInput.age
      }
    };
  }

  /**
   * 性能基准测试
   */
  private async testPerformanceBenchmarks(): Promise<any> {
    const benchmarks = {
      minimax: { requests: 0, totalTime: 0, averageTime: 0 },
      tongyi: { requests: 0, totalTime: 0, averageTime: 0 }
    };

    // MiniMax性能测试
    const minimaxClient = new MiniMaxClient();
    await minimaxClient.initialize(Config.getMiniMaxConfig());

    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      await minimaxClient.generateText({
        prompt: `测试文本生成性能 #${i + 1}`,
        max_tokens: 50
      });
      const duration = Date.now() - startTime;
      benchmarks.minimax.requests++;
      benchmarks.minimax.totalTime += duration;
    }
    benchmarks.minimax.averageTime = benchmarks.minimax.totalTime / benchmarks.minimax.requests;

    // 通义千问性能测试
    const tongyiClient = new TongyiClient();
    await tongyiClient.initialize(Config.getTongyiConfig());

    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      await tongyiClient.generateText({
        prompt: `测试文本生成性能 #${i + 1}`,
        max_tokens: 50
      });
      const duration = Date.now() - startTime;
      benchmarks.tongyi.requests++;
      benchmarks.tongyi.totalTime += duration;
    }
    benchmarks.tongyi.averageTime = benchmarks.tongyi.totalTime / benchmarks.tongyi.requests;

    return benchmarks;
  }

  /**
   * 错误处理机制测试
   */
  private async testErrorHandling(): Promise<any> {
    const errorTests = {
      invalidAPIKey: false,
      networkTimeout: false,
      invalidInput: false,
      rateLimiting: false
    };

    try {
      // 测试无效API密钥（通过模拟配置）
      const invalidClient = new TongyiClient();
      await invalidClient.initialize({
        apiKey: 'invalid_key_test',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        timeout: 5000,
        maxRetries: 1,
        retryDelayBase: 500
      });

      try {
        await invalidClient.generateText({
          prompt: '测试无效密钥',
          max_tokens: 10
        });
      } catch (error: any) {
        errorTests.invalidAPIKey = error.message.includes('401') || error.message.includes('unauthorized');
      }
    } catch (error) {
      // 初始化就失败也算错误处理正常
      errorTests.invalidAPIKey = true;
    }

    // 测试输入验证
    try {
      const ipService = new IPDiagnosisService();
      await ipService.initialize();
      
      // 使用空输入测试
      await ipService.generateDiagnosisReport({
        gender: '',
        age: 0,
        profession: '',
        industry: '',
        experience: '',
        targetAudience: '',
        audiencePain: '',
        businessGoal: ''
      });
    } catch (error) {
      errorTests.invalidInput = true;
    }

    return {
      errorHandlingTests: errorTests,
      summary: `${Object.values(errorTests).filter(Boolean).length}/4 错误处理测试通过`
    };
  }

  /**
   * 生成测试报告
   */
  private generateTestReport(): void {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    console.log('\\n📊 测试报告摘要');
    console.log('─'.repeat(40));
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests} ✅`);
    console.log(`失败: ${failedTests} ❌`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log(`总耗时: ${(totalDuration / 1000).toFixed(1)}秒`);
    console.log(`平均耗时: ${(totalDuration / totalTests / 1000).toFixed(2)}秒/测试`);

    console.log('\\n📋 详细结果');
    console.log('─'.repeat(40));
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const duration = (result.duration / 1000).toFixed(2);
      console.log(`${status} ${result.testName} (${duration}s)`);
      if (!result.success && result.error) {
        console.log(`   错误: ${result.error}`);
      }
    });

    if (failedTests > 0) {
      console.log('\\n⚠️  请检查失败的测试项目');
    } else {
      console.log('\\n🎉 所有测试通过！系统运行正常');
    }
  }

  /**
   * 获取测试结果
   */
  getTestResults(): TestResult[] {
    return this.testResults;
  }
}

/**
 * 主测试函数
 */
async function runComprehensiveTests() {
  // 设置日志级别
  logger.setLogLevel(LogLevel.WARN); // 减少测试期间的日志输出

  try {
    const testSuite = new ComprehensiveTestSuite();
    const results = await testSuite.runAllTests();
    
    // 恢复日志级别
    logger.setLogLevel(LogLevel.INFO);
    
    return results;
  } catch (error) {
    console.error('\\n💥 综合测试执行失败:', error);
    logger.error('ComprehensiveTest', 'main', '综合测试执行失败', error as Error);
    throw error;
  }
}

// 如果直接运行此文件，执行综合测试
if (require.main === module) {
  runComprehensiveTests().catch(console.error);
}

export { runComprehensiveTests, TestResult };