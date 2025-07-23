import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ApiError, ServiceConfig, PerformanceMetrics } from '../interfaces/api-types';
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker';
import { logger } from './logger';

/**
 * 增强配置接口
 */
export interface EnhancedServiceConfig extends ServiceConfig {
  circuitBreakerConfig?: CircuitBreakerConfig;
  rateLimitConfig?: {
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
  };
}

/**
 * 请求队列项
 */
interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

/**
 * 增强版API客户端
 * 包含断路器、限流、更好的错误处理等功能
 */
export class EnhancedApiClient {
  private client: AxiosInstance;
  private config: EnhancedServiceConfig;
  private metrics: PerformanceMetrics[] = [];
  private circuitBreaker: CircuitBreaker;
  private requestQueue: QueuedRequest[] = [];
  private requestCounts = {
    minute: { count: 0, resetTime: Date.now() + 60000 },
    hour: { count: 0, resetTime: Date.now() + 3600000 }
  };

  constructor(config: EnhancedServiceConfig) {
    this.config = config;
    
    // 初始化断路器
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreakerConfig || {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 30000,
        requestTimeout: config.timeout
      }
    );

    // 创建axios实例
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    this.setupInterceptors();
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.client.interceptors.request.use(
      (config: any) => {
        config.metadata = { startTime: Date.now() };
        // 添加请求ID
        config.headers['X-Request-ID'] = this.generateRequestId();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        this.recordMetrics(response, true);
        return response;
      },
      async (error: AxiosError) => {
        // 检查是否可以重试
        if (this.shouldRetryOnError(error)) {
          return this.handleRetryableError(error);
        }
        
        this.recordMetrics(error.response || error, false, error);
        return Promise.reject(this.transformError(error));
      }
    );
  }

  /**
   * 执行带限流和断路器保护的请求
   */
  async requestWithProtection<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    operation: string
  ): Promise<T> {
    // 检查限流
    await this.checkRateLimit();

    // 使用断路器执行请求
    return this.circuitBreaker.execute(
      async () => {
        const response = await this.requestWithRetry(requestFn, operation);
        return response;
      },
      operation
    );
  }

  /**
   * 执行带重试机制的请求（改进版）
   */
  private async requestWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    operation: string
  ): Promise<T> {
    const maxRetries = this.config.maxRetries || 3;
    const retryDelayBase = this.config.retryDelayBase || 1000;
    
    let lastError: ApiError;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await requestFn();
        return response.data;
      } catch (error) {
        lastError = error as ApiError;
        
        // 如果是最后一次尝试或错误不可重试，直接抛出
        if (attempt === maxRetries || !this.isRetryableError(lastError)) {
          throw lastError;
        }

        // 计算延迟时间（指数退避 + 抖动）
        const delay = this.calculateRetryDelay(attempt, retryDelayBase);
        
        logger.warn(
          'EnhancedApiClient',
          operation,
          `第 ${attempt + 1} 次重试失败，${delay}ms 后重试`,
          { 
            error: lastError.message,
            statusCode: lastError.status,
            attempt: attempt + 1
          }
        );
        
        await this.delay(delay);
        attempt++;
      }
    }

    throw lastError!;
  }

  /**
   * 处理可重试的错误
   */
  private async handleRetryableError(error: AxiosError): Promise<any> {
    const config = error.config;
    if (!config || !(config as any).metadata) {
      throw error;
    }

    // 实现智能重试逻辑
    const retryAfter = this.getRetryAfterHeader(error.response);
    if (retryAfter) {
      await this.delay(retryAfter * 1000);
      return this.client.request(config);
    }

    throw error;
  }

  /**
   * 检查限流
   */
  private async checkRateLimit(): Promise<void> {
    if (!this.config.rateLimitConfig) return;

    const now = Date.now();
    
    // 重置计数器
    if (now > this.requestCounts.minute.resetTime) {
      this.requestCounts.minute = { count: 0, resetTime: now + 60000 };
    }
    if (now > this.requestCounts.hour.resetTime) {
      this.requestCounts.hour = { count: 0, resetTime: now + 3600000 };
    }

    // 检查限制
    const { maxRequestsPerMinute, maxRequestsPerHour } = this.config.rateLimitConfig;
    
    if (this.requestCounts.minute.count >= maxRequestsPerMinute) {
      const waitTime = this.requestCounts.minute.resetTime - now;
      throw new Error(`限流：每分钟请求超限，请等待 ${Math.ceil(waitTime / 1000)} 秒`);
    }
    
    if (this.requestCounts.hour.count >= maxRequestsPerHour) {
      const waitTime = this.requestCounts.hour.resetTime - now;
      throw new Error(`限流：每小时请求超限，请等待 ${Math.ceil(waitTime / 60000)} 分钟`);
    }

    // 增加计数
    this.requestCounts.minute.count++;
    this.requestCounts.hour.count++;
  }

  /**
   * 计算重试延迟（指数退避 + 抖动）
   */
  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    // 指数退避
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    // 添加抖动（0.5x 到 1.5x）
    const jitter = 0.5 + Math.random();
    return Math.min(exponentialDelay * jitter, 30000); // 最大延迟30秒
  }

  /**
   * 从响应头获取重试延迟时间
   */
  private getRetryAfterHeader(response?: AxiosResponse): number | null {
    if (!response || !response.headers) return null;
    
    const retryAfter = response.headers['retry-after'];
    if (!retryAfter) return null;
    
    // 如果是数字，表示秒数
    const seconds = parseInt(retryAfter, 10);
    return isNaN(seconds) ? null : seconds;
  }

  /**
   * 判断错误是否应该重试
   */
  private shouldRetryOnError(error: AxiosError): boolean {
    // 如果有响应且状态码是429（限流），应该重试
    if (error.response?.status === 429) {
      return true;
    }
    return false;
  }

  /**
   * GET 请求
   */
  async get<T>(url: string, params?: any): Promise<T> {
    return this.requestWithProtection(
      () => this.client.get<T>(url, { params }),
      `GET ${url}`
    );
  }

  /**
   * POST 请求
   */
  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    return this.requestWithProtection(
      () => this.client.post<T>(url, data, config),
      `POST ${url}`
    );
  }

  /**
   * PUT 请求
   */
  async put<T>(url: string, data?: any): Promise<T> {
    return this.requestWithProtection(
      () => this.client.put<T>(url, data),
      `PUT ${url}`
    );
  }

  /**
   * DELETE 请求
   */
  async delete<T>(url: string): Promise<T> {
    return this.requestWithProtection(
      () => this.client.delete<T>(url),
      `DELETE ${url}`
    );
  }

  /**
   * 健康检查（改进版）
   */
  async healthCheck(endpoint: string = '/health'): Promise<boolean> {
    try {
      // 使用较短的超时时间进行健康检查
      const healthCheckClient = axios.create({
        baseURL: this.config.baseUrl,
        timeout: 5000,
        headers: this.client.defaults.headers
      });

      await healthCheckClient.get(endpoint);
      logger.info('EnhancedApiClient', 'healthCheck', '健康检查通过');
      return true;
    } catch (error) {
      logger.warn('EnhancedApiClient', 'healthCheck', '健康检查失败', { 
        error: (error as Error).message 
      });
      return false;
    }
  }

  /**
   * 获取性能指标
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * 获取断路器状态
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStats();
  }

  /**
   * 重置断路器
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }

  /**
   * 判断错误是否可重试（增强版）
   */
  private isRetryableError(error: ApiError): boolean {
    // 客户端错误通常不应重试（除了429）
    if (error.status && error.status >= 400 && error.status < 500) {
      return error.status === 429; // 只有限流错误可重试
    }
    
    // 网络错误、超时错误、5xx服务器错误可重试
    return (
      !error.status || 
      error.status >= 500 || 
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET'
    );
  }

  /**
   * 转换错误格式（增强版）
   */
  private transformError(error: any): ApiError {
    const apiError: ApiError = new Error(
      error.response?.data?.message || 
      error.response?.data?.error || 
      error.message || 
      '请求失败'
    ) as ApiError;
    
    apiError.code = error.code || error.response?.data?.code;
    apiError.status = error.response?.status;
    apiError.response = error.response?.data;
    apiError.retryable = this.isRetryableError(apiError);
    
    // 添加更多上下文信息
    if (error.config) {
      (apiError as any).requestInfo = {
        method: error.config.method,
        url: error.config.url,
        baseURL: error.config.baseURL
      };
    }
    
    return apiError;
  }

  /**
   * 记录性能指标（增强版）
   */
  private recordMetrics(
    response: AxiosResponse | any,
    success: boolean,
    error?: Error
  ): void {
    const config = response?.config || response;
    const startTime = config.metadata?.startTime || Date.now();
    const endTime = Date.now();

    const metric: PerformanceMetrics = {
      requestId: config.headers?.['X-Request-ID'] || this.generateRequestId(),
      service: 'enhanced-api-client',
      operation: `${config.method?.toUpperCase()} ${config.url}`,
      startTime,
      endTime,
      duration: endTime - startTime,
      success,
      error: error?.message,
      metadata: {
        status: response?.status,
        method: config.method,
        url: config.url,
        circuitBreakerState: this.circuitBreaker.getState(),
        retryCount: config.metadata?.retryCount || 0
      },
    };

    this.metrics.push(metric);
    
    // 保持最近2000条记录
    if (this.metrics.length > 2000) {
      this.metrics = this.metrics.slice(-2000);
    }

    // 记录慢请求
    if (metric.duration > 5000) {
      logger.warn('EnhancedApiClient', 'recordMetrics', '检测到慢请求', {
        duration: metric.duration,
        operation: metric.operation,
        status: metric.metadata?.status
      });
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}