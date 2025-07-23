#!/usr/bin/env ts-node

import {
  TextGenerationRequest,
} from '../interfaces/api-types';
import { logger } from '../utils/logger';
import { Config } from '../utils/config';

import { TongyiClient } from './tongyi-text-generation';

/**
 * IP诊断用户信息接口
 */
export interface IPDiagnosisInput {
  // 基本信息
  gender: string;           // 性别
  age: number;             // 年龄  
  profession: string;       // 职业
  industry: string;         // 所在行业
  experience: string;       // 职业经历
  
  // 目标受众
  targetAudience: string;   // 目标受众描述
  audiencePain: string;     // 受众痛点
  businessGoal: string;     // 商业目标
  
  // 内容现状
  currentContent?: string;   // 当前内容形式
  contentFrequency?: string; // 发布频率
  currentChallenges?: string; // 当前遇到的挑战
  
  // 商业现状
  currentBusiness?: string;  // 现有业务
  targetRevenue?: string;    // 目标收入
}

/**
 * IP诊断报告接口
 */
interface IPDiagnosisReport {
  // 第一部分：基本信息分析
  basicInfo: {
    summary: string;
    targetAudience: string;
    audiencePain: string;
    businessGoal: string;
  };
  
  // 第二部分：商业IP的4个标准建议（固定内容）
  businessStandards: {
    uniqueness: string;
    coreConsistency: string;
    contentQuality: string;
    valueFirst: string;
  };
  
  // 第三部分：定位及执行要点
  positioningAndExecution: {
    ipPositioning: string;
    publishFrequency: string;
    contentFormat: string;
    durationAdvice: string;
  };
  
  // 第四部分：选题方向
  contentTopics: {
    competitiveTopics: string;
    sharingTopics: string;
    industryTrends: string;
    serviceStandards: string;
    aiIntegration: string;
    seasonalTopics: string;
    personalLife: string;
  };
  
  // 附加建议
  additionalAdvice: {
    contentStrategy: string;
    monetizationSuggestions: string;
    nextSteps: string;
  };
}

/**
 * IP诊断服务类
 */
export class IPDiagnosisService {
  private tongyiClient: TongyiClient;
  
  constructor() {
    this.tongyiClient = new TongyiClient();
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    const config = Config.getTongyiConfig();

    await this.tongyiClient.initialize(config);
    logger.info('IPDiagnosisService', 'initialize', 'IP诊断服务初始化完成');
  }

  /**
   * 生成完整的IP诊断报告
   */
  async generateDiagnosisReport(input: IPDiagnosisInput): Promise<IPDiagnosisReport> {
    logger.info('IPDiagnosisService', 'generateDiagnosisReport', '开始生成IP诊断报告', {
      industry: input.industry,
      profession: input.profession,
    });

    const startTime = Date.now();

    try {
      // 第一部分：基本信息分析
      const basicInfo = await this.analyzeBasicInfo(input);
      
      // 第二部分：固定的商业IP标准
      const businessStandards = this.getBusinessStandards();
      
      // 第三部分：定位及执行要点
      const positioningAndExecution = await this.analyzePositioningAndExecution(input);
      
      // 第四部分：选题方向
      const contentTopics = await this.generateContentTopics(input);
      
      // 附加建议
      const additionalAdvice = await this.generateAdditionalAdvice(input);

      const report: IPDiagnosisReport = {
        basicInfo,
        businessStandards,
        positioningAndExecution,
        contentTopics,
        additionalAdvice,
      };

      const duration = Date.now() - startTime;

      logger.info('IPDiagnosisService', 'generateDiagnosisReport', 'IP诊断报告生成完成', {
        duration,
        reportSections: 5,
      });

      return report;

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('IPDiagnosisService', 'generateDiagnosisReport', 'IP诊断报告生成失败', error as Error, {
        duration,
        industry: input.industry,
      });
      throw error;
    }
  }

  /**
   * 分析基本信息
   */
  private async analyzeBasicInfo(input: IPDiagnosisInput): Promise<IPDiagnosisReport['basicInfo']> {
    const prompt = `作为专业的IP顾问，请基于以下信息进行基本分析：

用户基本信息：
- 性别年龄：${input.gender}，${input.age}岁
- 职业经历：${input.profession}，${input.experience}
- 所在行业：${input.industry}

用户提供的信息：
- 目标受众：${input.targetAudience}
- 受众痛点：${input.audiencePain}  
- 商业目标：${input.businessGoal}

请按照以下格式输出分析结果：

IP领域个人信息：[简洁概括用户的基本信息]

目标受众：[基于用户描述，进行专业分析和细化]

受众痛点：[深入分析受众痛点，并指出关键问题]

商业目标：[分析商业目标的合理性，给出优化建议]`;

    const request: TextGenerationRequest = {
      prompt,
      max_tokens: 800,
      temperature: 0.3, // 较低温度确保专业性
    };

    const result = await this.tongyiClient.generateText(request);
    
    // 解析生成的内容（简化版本，实际可能需要更复杂的解析逻辑）
    const content = result.text;
    
    return {
      summary: this.extractSection(content, 'IP领域个人信息：') || '基本信息分析',
      targetAudience: this.extractSection(content, '目标受众：') || '目标受众分析',
      audiencePain: this.extractSection(content, '受众痛点：') || '受众痛点分析',
      businessGoal: this.extractSection(content, '商业目标：') || '商业目标分析',
    };
  }

  /**
   * 获取固定的商业IP标准
   */
  private getBusinessStandards(): IPDiagnosisReport['businessStandards'] {
    return {
      uniqueness: 'IP是独一无二的，生活处处是标准，为啥却更需要为生活',
      coreConsistency: '日更前，一定要核心理念是清晰的。',
      contentQuality: '商业社群中，有受众加微信，且提出了针对业务的问题解答，就是好内容。',
      valueFirst: '当答不到精准时，跟同行业区别，你的看法态度比率就是解答方法',
    };
  }

  /**
   * 分析定位及执行要点
   */
  private async analyzePositioningAndExecution(input: IPDiagnosisInput): Promise<IPDiagnosisReport['positioningAndExecution']> {
    const prompt = `基于以下用户信息，请为其制定IP定位和执行策略：

用户信息：
- 职业：${input.profession}
- 行业：${input.industry}
- 目标受众：${input.targetAudience}
- 商业目标：${input.businessGoal}

请用一句话概括这个用户的IP定位，要求：
1. 体现专业领域
2. 突出服务的目标人群
3. 明确价值主张
4. 简洁有力，朗朗上口

格式：为[目标受众]提供[专业价值]的[行业身份]

例如："为创业者提供实战营销策略的资深市场总监"`;

    const request: TextGenerationRequest = {
      prompt,
      max_tokens: 200,
      temperature: 0.4,
    };

    const result = await this.tongyiClient.generateText(request);
    const ipPositioning = result.text.trim();

    return {
      ipPositioning,
      publishFrequency: '日更，日更，日更',
      contentFormat: '原创为主（搭配账号技术及IP标准积累积累好）',
      durationAdvice: '30-40秒',
    };
  }

  /**
   * 生成内容选题方向
   */
  private async generateContentTopics(input: IPDiagnosisInput): Promise<IPDiagnosisReport['contentTopics']> {
    const prompt = `作为${input.industry}行业的内容策划专家，请为${input.profession}制定7个维度的选题方向：

用户背景：
- 行业：${input.industry}
- 职业：${input.profession}
- 目标受众：${input.targetAudience}

请为每个维度提供3-5个具体的选题建议：

1. ${input.industry}行业的竞争性话题
2. ${input.industry}行业分享性话题
3. ${input.industry}行业最新议题与趋势
4. ${input.industry}行业的受众服务标准/执行
5. ${input.industry}行业与AI结合的建议议题
6. 新季节营销与${input.industry}行业结合的话题
7. 能反映个人品质的生活化内容

每个维度用简洁的要点形式列出，便于实际执行。`;

    const request: TextGenerationRequest = {
      prompt,
      max_tokens: 1200,
      temperature: 0.6,
    };

    const result = await this.tongyiClient.generateText(request);
    const content = result.text;

    // 简化解析，实际项目中可以使用更精确的解析方法
    const topics = {
      competitiveTopics: this.extractTopicSection(content, '1.') || '竞争性话题建议',
      sharingTopics: this.extractTopicSection(content, '2.') || '分享性话题建议',
      industryTrends: this.extractTopicSection(content, '3.') || '行业趋势话题建议',
      serviceStandards: this.extractTopicSection(content, '4.') || '服务标准话题建议',
      aiIntegration: this.extractTopicSection(content, '5.') || 'AI结合话题建议',
      seasonalTopics: this.extractTopicSection(content, '6.') || '季节营销话题建议',
      personalLife: this.extractTopicSection(content, '7.') || '生活化内容建议',
    };

    return topics;
  }

  /**
   * 生成附加建议
   */
  private async generateAdditionalAdvice(input: IPDiagnosisInput): Promise<IPDiagnosisReport['additionalAdvice']> {
    const prompt = `作为资深IP顾问，请为以下用户制定综合建议：

用户档案：
- ${input.gender}，${input.age}岁
- 职业：${input.profession}  
- 行业：${input.industry}
- 目标受众：${input.targetAudience}
- 商业目标：${input.businessGoal}

请从以下三个方面提供专业建议：

1. 内容策略建议：
   - 基于六三一原则（六分热点+三分专业+一分生活）
   - 结合用户行业特点的具体执行建议

2. 商业变现建议：
   - 基于用户当前资源和目标的变现路径
   - 产品设计和定价策略建议

3. 下一步行动计划：
   - 具体的执行步骤和时间节点
   - 关键里程碑和评估标准

请给出实用、具体、可执行的建议。`;

    const request: TextGenerationRequest = {
      prompt,
      max_tokens: 1000,
      temperature: 0.5,
    };

    const result = await this.tongyiClient.generateText(request);
    const content = result.text;

    return {
      contentStrategy: this.extractAdviceSection(content, '1.') || '内容策略建议',
      monetizationSuggestions: this.extractAdviceSection(content, '2.') || '商业变现建议',
      nextSteps: this.extractAdviceSection(content, '3.') || '下一步行动计划',
    };
  }

  /**
   * 格式化输出完整报告
   */
  formatReport(report: IPDiagnosisReport): string {
    return `
# IP定位诊断报告

## 第一部分：基本信息

**IP领域个人信息：** ${report.basicInfo.summary}

**目标受众：** ${report.basicInfo.targetAudience}

**受众痛点：** ${report.basicInfo.audiencePain}

**商业目标：** ${report.basicInfo.businessGoal}

## 第二部分：商业IP的4个标准建议

**（内容固定）独特首创：** ${report.businessStandards.uniqueness}

**（内容固定）创意核心一致：** ${report.businessStandards.coreConsistency}

**（内容固定）好内容的标准：** ${report.businessStandards.contentQuality}

**（内容固定）价值观重于解答：** ${report.businessStandards.valueFirst}

## 第三部分：定位及执行要点

**IP定位：** ${report.positioningAndExecution.ipPositioning}

**（内容固定）发布频率：** ${report.positioningAndExecution.publishFrequency}

**（内容固定）内容形式：** ${report.positioningAndExecution.contentFormat}

**（内容固定）时长建议：** ${report.positioningAndExecution.durationAdvice}

## 第四部分：选题方向

**行业竞争性话题：** ${report.contentTopics.competitiveTopics}

**行业分享性话题：** ${report.contentTopics.sharingTopics}

**行业最新议题与趋势：** ${report.contentTopics.industryTrends}

**行业受众服务标准/执行：** ${report.contentTopics.serviceStandards}

**行业与AI结合的建议议题：** ${report.contentTopics.aiIntegration}

**新季节营销与行业结合的建议话题：** ${report.contentTopics.seasonalTopics}

**IP的生活属性内容：** ${report.contentTopics.personalLife}

## 第五部分：专业建议

### 内容策略建议
${report.additionalAdvice.contentStrategy}

### 商业变现建议  
${report.additionalAdvice.monetizationSuggestions}

### 下一步行动计划
${report.additionalAdvice.nextSteps}

---

**注：带有"（内容固定）"标记的部分为固定内容，每个客户都使用相同内容。其他部分根据客户实际情况个性化定制。**
`.trim();
  }

  /**
   * 提取文本中的特定段落
   */
  private extractSection(content: string, sectionName: string): string {
    const regex = new RegExp(`${sectionName}\\s*([^\\n]*(?:\\n(?!\\w+：)[^\\n]*)*)`, 'i');
    const match = content.match(regex);

    return match ? match[1].trim() : '';
  }

  /**
   * 提取选题段落
   */
  private extractTopicSection(content: string, prefix: string): string {
    const regex = new RegExp(`${prefix}[^\\d\\.]*?(?=\\d+\\.|$)`, 's');
    const match = content.match(regex);

    return match ? match[0].replace(prefix, '').trim() : '';
  }

  /**
   * 提取建议段落
   */
  private extractAdviceSection(content: string, prefix: string): string {
    const regex = new RegExp(`${prefix}[^\\d\\.]*?(?=\\d+\\.|$)`, 's');
    const match = content.match(regex);

    return match ? match[0].replace(prefix, '').trim() : '';
  }
}

/**
 * 测试函数
 */
async function testIPDiagnosis() {
  console.log('\\n=== IP诊断服务验证测试 ===\\n');

  try {
    // 初始化服务
    const ipService = new IPDiagnosisService();

    await ipService.initialize();

    // 准备测试数据
    const testInput: IPDiagnosisInput = {
      gender: '女',
      age: 32,
      profession: '资深市场营销经理',
      industry: '数字营销',
      experience: '8年互联网营销经验，曾在字节跳动、美团等大厂任职',
      targetAudience: '中小企业创始人和营销负责人',
      audiencePain: '获客成本高，转化率低，不知道如何做好品牌营销',
      businessGoal: '提供营销咨询服务，年收入目标100万',
      currentContent: '偶尔发布营销干货文章',
      contentFrequency: '每周2-3次',
      currentChallenges: '不知道如何持续输出有价值的内容',
      currentBusiness: '兼职做营销咨询',
      targetRevenue: '年收入100万',
    };

    console.log('1. 测试数据准备完成');
    console.log(`   用户：${testInput.gender}，${testInput.age}岁，${testInput.profession}`);
    console.log(`   行业：${testInput.industry}`);
    console.log(`   目标：${testInput.businessGoal}`);

    console.log('\\n2. 开始生成IP诊断报告...');
    const report = await ipService.generateDiagnosisReport(testInput);

    console.log('\\n3. 报告生成完成，开始验证完整性...');
    
    // 验证报告完整性
    const validationResults = [
      { section: '基本信息分析', valid: !!report.basicInfo.summary },
      { section: '目标受众分析', valid: !!report.basicInfo.targetAudience },
      { section: '受众痛点分析', valid: !!report.basicInfo.audiencePain },
      { section: '商业目标分析', valid: !!report.basicInfo.businessGoal },
      { section: 'IP定位建议', valid: !!report.positioningAndExecution.ipPositioning },
      { section: '选题方向建议', valid: !!report.contentTopics.competitiveTopics },
      { section: '内容策略建议', valid: !!report.additionalAdvice.contentStrategy },
      { section: '商业变现建议', valid: !!report.additionalAdvice.monetizationSuggestions },
      { section: '行动计划建议', valid: !!report.additionalAdvice.nextSteps },
    ];

    validationResults.forEach((result) => {
      console.log(`   ${result.valid ? '✅' : '❌'} ${result.section}`);
    });

    const allValid = validationResults.every((r) => r.valid);

    console.log(`\\n报告完整性验证: ${allValid ? '✅ 通过' : '❌ 失败'}`);

    console.log('\\n4. 输出格式化报告预览...');
    const formattedReport = ipService.formatReport(report);
    
    // 显示报告的前500字符作为预览
    console.log('\\n--- 报告预览 ---');
    console.log(`${formattedReport.substring(0, 500)  }...`);
    console.log(`\\n完整报告长度: ${formattedReport.length} 字符`);

    console.log('\\n5. IP定位核心结果:');
    console.log(`   IP定位: ${report.positioningAndExecution.ipPositioning}`);

    // 输出性能指标
    console.log('\\n=== 性能指标 ===');
    const metrics = ipService['tongyiClient']['apiClient']?.getMetrics() || [];

    metrics.forEach((metric) => {
      logger.logMetrics(metric);
    });

    // 输出日志摘要
    logger.printSummary();

    console.log('\\n🎉 IP诊断服务验证测试完成！');

  } catch (error: any) {
    console.error('\\n❌ 测试过程中发生错误:', error.message);
    logger.error('IPDiagnosisService', 'test', '测试失败', error);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testIPDiagnosis().catch(console.error);
}