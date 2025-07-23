/**
 * 断路器模式实现，用于防止级联失败
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;     // 故障阈值
  resetTimeout: number;         // 重置超时时间（毫秒）
  monitoringPeriod: number;     // 监控周期（毫秒）
  requestTimeout?: number;      // 请求超时时间
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN', 
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;
  
  constructor(private config: CircuitBreakerConfig) {}

  /**
   * 执行请求并管理断路器状态
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // 检查断路器状态
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime!) {
        throw new Error(`断路器开启: ${operationName} 暂时不可用`);
      }
      // 尝试进入半开状态
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await this.executeWithTimeout(operation);
      
      // 成功执行
      this.onSuccess();
      return result;
    } catch (error) {
      // 执行失败
      this.onFailure();
      throw error;
    }
  }

  /**
   * 获取断路器当前状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * 重置断路器
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  /**
   * 执行操作并设置超时
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.requestTimeout) {
      return operation();
    }

    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('请求超时')), this.config.requestTimeout)
      )
    ]);
  }

  /**
   * 处理成功情况
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // 半开状态下成功，重置断路器
      this.reset();
    } else {
      this.successCount++;
      // 在监控周期内重置失败计数
      if (this.shouldResetCounters()) {
        this.failureCount = 0;
        this.successCount = 1;
      }
    }
  }

  /**
   * 处理失败情况
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // 半开状态失败，重新打开断路器
      this.openCircuit();
    } else if (this.failureCount >= this.config.failureThreshold) {
      // 达到失败阈值，打开断路器
      this.openCircuit();
    }
  }

  /**
   * 打开断路器
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
  }

  /**
   * 检查是否应该重置计数器
   */
  private shouldResetCounters(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime > this.config.monitoringPeriod;
  }
}