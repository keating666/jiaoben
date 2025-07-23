#!/usr/bin/env ts-node

import { Config } from '../utils/config';
import { logger } from '../utils/logger';

import { MiniMaxClientV2 } from './minimax-client-v2';
import { TongyiClient } from './tongyi-text-generation';

/**
 * API 服务健康检查脚本
 * 用于监控各个 AI 服务的可用性
 */

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  error?: string;
  timestamp: Date;
}

class HealthChecker {
  private results: HealthCheckResult[] = [];

  /**
   * 执行所有服务的健康检查
   */
  async checkAllServices(): Promise<HealthCheckResult[]> {
    console.log('🏥 开始 API 服务健康检查...\n');

    // 检查环境变量
    const validation = Config.validateEnv();

    if (!validation.valid) {
      console.error('❌ 环境变量配置不完整:', validation.missing.join(', '));
      console.log('提示: 在 CI 环境中，请使用 MONITOR_ 前缀的环境变量');
    }

    // 并行检查所有服务
    const checks = await Promise.allSettled([
      this.checkMiniMax(),
      this.checkTongyi(),
      // this.checkIflytek(), // 可以添加更多服务
    ]);

    // 处理结果
    checks.forEach((result, index) => {
      if (result.status === 'rejected') {
        const serviceName = ['MiniMax', 'Tongyi'][index];

        this.results.push({
          service: serviceName,
          status: 'down',
          error: result.reason?.message || 'Unknown error',
          timestamp: new Date(),
        });
      }
    });

    this.printReport();

    return this.results;
  }

  /**
   * 检查 MiniMax 服务
   */
  private async checkMiniMax(): Promise<void> {
    const startTime = Date.now();
    const service = 'MiniMax';

    try {
      const client = new MiniMaxClientV2();
      const config = this.getConfigWithFallback('MINIMAX');
      
      await client.initialize(config);
      const isHealthy = await client.healthCheck();
      
      const responseTime = Date.now() - startTime;

      this.results.push({
        service,
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        timestamp: new Date(),
      });

      // 额外测试：尝试一个简单的文本生成
      if (isHealthy) {
        const testStart = Date.now();

        await client.generateText({
          prompt: 'Hi',
          max_tokens: 5,
          temperature: 0.1,
        });
        const apiResponseTime = Date.now() - testStart;
        
        logger.info(service, 'health-check', `API 响应时间: ${apiResponseTime}ms`);
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      this.results.push({
        service,
        status: 'down',
        responseTime,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 检查通义千问服务
   */
  private async checkTongyi(): Promise<void> {
    const startTime = Date.now();
    const service = 'Tongyi';

    try {
      const client = new TongyiClient();
      const config = this.getConfigWithFallback('TONGYI');
      
      await client.initialize(config);
      const isHealthy = await client.healthCheck();
      
      const responseTime = Date.now() - startTime;

      this.results.push({
        service,
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        timestamp: new Date(),
      });
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      this.results.push({
        service,
        status: 'down',
        responseTime,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 获取配置（支持 MONITOR_ 前缀的环境变量）
   */
  private getConfigWithFallback(service: string): any {
    const monitorKey = `MONITOR_${service}_API_KEY`;
    const regularKey = `${service}_API_KEY`;
    
    const apiKey = process.env[monitorKey] || process.env[regularKey];
    
    if (!apiKey) {
      throw new Error(`未找到 ${service} 的 API 密钥`);
    }

    // 根据服务类型返回相应配置
    switch (service) {
      case 'MINIMAX':
        return {
          apiKey,
          baseUrl: process.env.MINIMAX_API_BASE_URL || 'https://api.minimax.chat',
          timeout: 10000, // 健康检查使用较短超时
          maxRetries: 1,
          groupId: process.env.MINIMAX_GROUP_ID || process.env.MONITOR_MINIMAX_GROUP_ID,
        };
      case 'TONGYI':
        return {
          apiKey,
          baseUrl: process.env.TONGYI_API_BASE_URL || 'https://dashscope.aliyuncs.com',
          timeout: 10000,
          maxRetries: 1,
        };
      default:
        throw new Error(`未知服务: ${service}`);
    }
  }

  /**
   * 打印健康检查报告
   */
  private printReport(): void {
    console.log('\n📊 健康检查报告\n');
    console.log('服务\t\t状态\t\t响应时间\t错误信息');
    console.log('─'.repeat(70));

    let healthyCount = 0;
    let degradedCount = 0;
    let downCount = 0;

    this.results.forEach((result) => {
      const status = this.getStatusEmoji(result.status);
      const responseTime = result.responseTime ? `${result.responseTime}ms` : 'N/A';
      const error = result.error || '-';
      
      console.log(`${result.service}\t\t${status}\t\t${responseTime}\t\t${error}`);

      switch (result.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'down':
          downCount++;
          break;
      }
    });

    console.log('─'.repeat(70));
    console.log('\n📈 总结:');
    console.log(`✅ 健康: ${healthyCount}`);
    console.log(`⚠️  降级: ${degradedCount}`);
    console.log(`❌ 故障: ${downCount}`);
    console.log(`\n检查时间: ${new Date().toLocaleString()}`);

    // 如果有服务不健康，退出码设为 1
    if (downCount > 0 || degradedCount > 0) {
      process.exitCode = 1;
    }
  }

  /**
   * 获取状态对应的 emoji
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'healthy':
        return '✅ 健康';
      case 'degraded':
        return '⚠️  降级';
      case 'down':
        return '❌ 故障';
      default:
        return '❓ 未知';
    }
  }

  /**
   * 导出为 JSON（用于 CI/CD）
   */
  exportJSON(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      services: this.results,
      summary: {
        total: this.results.length,
        healthy: this.results.filter((r) => r.status === 'healthy').length,
        degraded: this.results.filter((r) => r.status === 'degraded').length,
        down: this.results.filter((r) => r.status === 'down').length,
      },
    }, null, 2);
  }
}

/**
 * 主函数
 */
async function main() {
  const checker = new HealthChecker();
  
  try {
    await checker.checkAllServices();
    
    // 如果在 CI 环境，输出 JSON
    if (process.env.CI) {
      console.log('\n📄 JSON 输出:');
      console.log(checker.exportJSON());
    }
  } catch (error) {
    console.error('❌ 健康检查失败:', error);
    process.exit(1);
  }
}

// 运行健康检查
if (require.main === module) {
  main().catch(console.error);
}