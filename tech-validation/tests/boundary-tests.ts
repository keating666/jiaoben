#!/usr/bin/env ts-node

import { describe, it, assert, runner } from './test-framework';
import { MiniMaxClientV2 } from '../scripts/minimax-client-v2';
import { TongyiClient } from '../scripts/tongyi-text-generation';
import { IPDiagnosisService, IPDiagnosisInput } from '../scripts/ip-diagnosis';
import { Config } from '../utils/config';
import { logger, LogLevel } from '../utils/logger';

/**
 * 边界条件和异常处理测试套件
 */
describe('边界条件测试套件', () => {
  describe('输入验证测试', () => {
    it('应该拒绝空的音频文件', async () => {
      const client = new MiniMaxClientV2();
      await client.initialize(Config.getMiniMaxConfig());
      
      await assert.throws(
        () => client.speechToText({}),
        '必须提供音频文件或音频URL',
        '应该拒绝空的音频输入'
      );
    });

    it('应该拒绝超大音频文件', async () => {
      const client = new MiniMaxClientV2();
      await client.initialize(Config.getMiniMaxConfig());
      
      // 创建11MB的模拟文件
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      
      await assert.throws(
        () => client.speechToText({
          audioFile: largeBuffer,
          format: 'mp3'
        }),
        '音频文件超过10MB限制',
        '应该拒绝超过10MB的文件'
      );
    });

    it('应该拒绝不支持的音频格式', async () => {
      const client = new MiniMaxClientV2();
      await client.initialize(Config.getMiniMaxConfig());
      
      await assert.throws(
        () => client.speechToText({
          audioFile: Buffer.from('test'),
          format: 'avi' as any
        }),
        '不支持的音频格式',
        '应该拒绝不支持的格式'
      );
    });

    it('应该拒绝无效的URL', async () => {
      const client = new MiniMaxClientV2();
      await client.initialize(Config.getMiniMaxConfig());
      
      await assert.throws(
        () => client.speechToText({
          audioUrl: 'not-a-valid-url'
        }),
        '无效的音频URL',
        '应该拒绝无效的URL格式'
      );
    });
  });

  describe('文本生成边界测试', () => {
    it('应该处理空的prompt', async () => {
      const client = new TongyiClient();
      await client.initialize(Config.getTongyiConfig());
      
      const result = await client.generateText({
        prompt: '',
        max_tokens: 10
      });
      
      assert.isDefined(result.text, '应该返回结果即使prompt为空');
    });

    it('应该限制max_tokens到合理范围', async () => {
      const client = new MiniMaxClientV2();
      await client.initialize(Config.getMiniMaxConfig());
      
      // 内部应该将过大的值限制到4096
      const result = await client.generateText({
        prompt: 'Hello',
        max_tokens: 10000
      });
      
      assert.isDefined(result.text, '应该成功生成文本');
      assert.isLessThan(result.text.length, 5000, '输出不应该超过合理长度');
    });

    it('应该正确处理极端temperature值', async () => {
      const client = new TongyiClient();
      await client.initialize(Config.getTongyiConfig());
      
      // 测试温度为0（最确定性）
      const deterministicResult = await client.generateText({
        prompt: '1+1=',
        max_tokens: 5,
        temperature: 0
      });
      
      assert.contains(deterministicResult.text, '2', '温度0应该产生确定性结果');
      
      // 测试温度为2（最随机）
      const randomResult = await client.generateText({
        prompt: '创意写作：',
        max_tokens: 50,
        temperature: 2
      });
      
      assert.isDefined(randomResult.text, '高温度也应该产生有效结果');
    });

    it('应该处理超长prompt', async () => {
      const client = new TongyiClient();
      await client.initialize(Config.getTongyiConfig());
      
      // 创建一个非常长的prompt（10000字符）
      const longPrompt = 'A'.repeat(10000);
      
      try {
        const result = await client.generateText({
          prompt: longPrompt,
          max_tokens: 10
        });
        assert.isDefined(result.text, '应该能处理长prompt或优雅地失败');
      } catch (error: any) {
        assert.contains(error.message, 'token', '错误应该提到token限制');
      }
    });
  });

  describe('IP诊断边界测试', () => {
    it('应该处理最小年龄', async () => {
      const service = new IPDiagnosisService();
      await service.initialize();
      
      const youngInput: IPDiagnosisInput = {
        gender: '男',
        age: 18, // 最小合法工作年龄
        profession: '实习生',
        industry: '互联网',
        experience: '无经验',
        targetAudience: '同龄人',
        audiencePain: '找工作困难',
        businessGoal: '分享求职经验'
      };
      
      const report = await service.generateDiagnosisReport(youngInput);
      assert.isDefined(report.positioningAndExecution.ipPositioning, '应该为年轻用户生成定位');
    });

    it('应该处理最大年龄', async () => {
      const service = new IPDiagnosisService();
      await service.initialize();
      
      const seniorInput: IPDiagnosisInput = {
        gender: '女',
        age: 65, // 退休年龄
        profession: '退休教师',
        industry: '教育',
        experience: '40年教学经验',
        targetAudience: '终身学习者',
        audiencePain: '退休后如何保持活力',
        businessGoal: '分享人生智慧'
      };
      
      const report = await service.generateDiagnosisReport(seniorInput);
      assert.isDefined(report.positioningAndExecution.ipPositioning, '应该为年长用户生成定位');
    });

    it('应该处理特殊字符输入', async () => {
      const service = new IPDiagnosisService();
      await service.initialize();
      
      const specialInput: IPDiagnosisInput = {
        gender: '男',
        age: 30,
        profession: 'UI/UX设计师 & 前端开发',
        industry: 'IT/互联网',
        experience: '5年+经验，精通React/Vue',
        targetAudience: '0-3年经验的设计师/开发者',
        audiencePain: '设计&开发协作难题；工具选择困难',
        businessGoal: '提供"设计+开发"一体化解决方案，年收入100w+'
      };
      
      const report = await service.generateDiagnosisReport(specialInput);
      assert.isDefined(report.basicInfo.summary, '应该能处理包含特殊字符的输入');
    });

    it('应该处理极长的描述文本', async () => {
      const service = new IPDiagnosisService();
      await service.initialize();
      
      const verboseInput: IPDiagnosisInput = {
        gender: '女',
        age: 35,
        profession: '全栈工程师',
        industry: 'SaaS',
        experience: 'A'.repeat(500), // 500字符的经验描述
        targetAudience: 'B'.repeat(300), // 300字符的目标受众
        audiencePain: 'C'.repeat(400), // 400字符的痛点描述
        businessGoal: 'D'.repeat(200) // 200字符的商业目标
      };
      
      const report = await service.generateDiagnosisReport(verboseInput);
      assert.isDefined(report.positioningAndExecution.ipPositioning, '应该能处理长文本输入');
      assert.isGreaterThan(
        report.positioningAndExecution.ipPositioning.length, 
        10, 
        '即使输入很长也应该生成有意义的定位'
      );
    });
  });

  describe('并发和性能边界测试', () => {
    it('应该处理并发请求', async () => {
      const client = new TongyiClient();
      await client.initialize(Config.getTongyiConfig());
      
      // 同时发起5个请求
      const promises = Array(5).fill(null).map((_, i) => 
        client.generateText({
          prompt: `并发测试 ${i}`,
          max_tokens: 20
        })
      );
      
      const results = await Promise.all(promises);
      assert.equal(results.length, 5, '所有并发请求都应该完成');
      results.forEach((result, i) => {
        assert.isDefined(result.text, `请求 ${i} 应该有结果`);
      });
    });

    it('应该在限流情况下优雅降级', async () => {
      const client = new MiniMaxClientV2();
      await client.initialize(Config.getMiniMaxConfig());
      
      // 快速发送3个请求
      const results: any[] = [];
      const errors: any[] = [];
      
      for (let i = 0; i < 3; i++) {
        try {
          const result = await client.generateText({
            prompt: `限流测试 ${i}`,
            max_tokens: 10
          });
          results.push(result);
        } catch (error) {
          errors.push(error);
        }
      }
      
      assert.equal(results.length, 2, '前2个请求应该成功');
      assert.equal(errors.length, 1, '第3个请求应该被限流');
      assert.contains(errors[0].message, '限流', '错误信息应该提到限流');
    });
  });

  describe('错误恢复测试', () => {
    it('应该从临时故障中恢复', async () => {
      let failCount = 0;
      const mockClient = {
        async generateText(request: any) {
          failCount++;
          if (failCount < 3) {
            throw new Error('临时网络错误');
          }
          return { text: '成功', model: 'test' };
        }
      };
      
      // 模拟带重试的调用
      let attempts = 0;
      let result;
      while (attempts < 5) {
        try {
          result = await mockClient.generateText({ prompt: 'test' });
          break;
        } catch (error) {
          attempts++;
          if (attempts >= 5) throw error;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      assert.equal(result?.text, '成功', '应该在重试后成功');
      assert.equal(attempts, 2, '应该在第3次尝试时成功');
    });

    it('应该正确处理部分成功的批处理', async () => {
      const service = new IPDiagnosisService();
      await service.initialize();
      
      const inputs: IPDiagnosisInput[] = [
        {
          gender: '男',
          age: 25,
          profession: '产品经理',
          industry: '互联网',
          experience: '3年',
          targetAudience: '创业者',
          audiencePain: '产品规划',
          businessGoal: '咨询服务'
        },
        {
          gender: '女',
          age: -1, // 无效年龄
          profession: '设计师',
          industry: '广告',
          experience: '5年',
          targetAudience: '品牌方',
          audiencePain: '视觉升级',
          businessGoal: '设计服务'
        }
      ];
      
      const results = await Promise.allSettled(
        inputs.map(input => service.generateDiagnosisReport(input))
      );
      
      assert.equal(results[0].status, 'fulfilled', '有效输入应该成功');
      assert.equal(results[1].status, 'fulfilled', 'AI应该能处理异常输入');
    });
  });

  describe('编码和字符集测试', () => {
    it('应该正确处理中文字符', async () => {
      const client = new TongyiClient();
      await client.initialize(Config.getTongyiConfig());
      
      const result = await client.generateText({
        prompt: '请解释"天道酬勤"的含义',
        max_tokens: 100
      });
      
      assert.isDefined(result.text, '应该能处理中文输入');
      assert.isGreaterThan(result.text.length, 10, '应该生成有意义的中文回复');
    });

    it('应该处理emoji和特殊Unicode字符', async () => {
      const client = new TongyiClient();
      await client.initialize(Config.getTongyiConfig());
      
      const result = await client.generateText({
        prompt: '请为这个标题加上合适的emoji：庆祝成功 🎉',
        max_tokens: 50
      });
      
      assert.isDefined(result.text, '应该能处理emoji');
    });

    it('应该处理多语言混合输入', async () => {
      const service = new IPDiagnosisService();
      await service.initialize();
      
      const multilingualInput: IPDiagnosisInput = {
        gender: '男',
        age: 28,
        profession: 'Full-Stack Developer / 全栈工程师',
        industry: 'FinTech金融科技',
        experience: '5 years，精通Python/JavaScript',
        targetAudience: 'B2B SaaS用户',
        audiencePain: 'API集成困难，缺乏best practices',
        businessGoal: '提供技术consulting，目标ARR $500K'
      };
      
      const report = await service.generateDiagnosisReport(multilingualInput);
      assert.isDefined(report.basicInfo.summary, '应该能处理中英文混合输入');
    });
  });
});

// 运行测试
if (require.main === module) {
  logger.setLogLevel(LogLevel.WARN); // 减少测试时的日志输出
  runner.run().catch(console.error);
}