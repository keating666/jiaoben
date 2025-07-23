import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiError, ServiceConfig, PerformanceMetrics } from '../interfaces/api-types';

/**
 * 通用API客户端工具类
 */
export class ApiClient {
  private client: AxiosInstance;
  private config: ServiceConfig;
  private metrics: PerformanceMetrics[] = [];

  constructor(config: ServiceConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    // 添加请求拦截器
    this.client.interceptors.request.use(
      (config: any) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 添加响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        this.recordMetrics(response, true);
        return response;
      },
      (error) => {
        this.recordMetrics(error.response || error, false, error);
        return Promise.reject(this.transformError(error));
      }
    );
  }

  /**
   * 执行带重试机制的请求
   */
  async requestWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    operation: string
  ): Promise<T> {
    const maxRetries = this.config.maxRetries || 3;
    const retryDelayBase = this.config.retryDelayBase || 1000;
    
    let lastError: ApiError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await requestFn();
        return response.data;
      } catch (error) {
        lastError = error as ApiError;
        
        // 如果是最后一次尝试或错误不可重试，直接抛出
        if (attempt === maxRetries || !this.isRetryableError(lastError)) {
          throw lastError;
        }

        // 计算延迟时间（指数退避）
        const delay = retryDelayBase * Math.pow(2, attempt);
        console.warn(`${operation} 第 ${attempt + 1} 次重试失败，${delay}ms 后重试:`, lastError.message);
        
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * GET 请求
   */
  async get<T>(url: string, params?: any): Promise<T> {
    return this.requestWithRetry(
      () => this.client.get<T>(url, { params }),
      `GET ${url}`
    );
  }

  /**
   * POST 请求
   */
  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    return this.requestWithRetry(
      () => this.client.post<T>(url, data, config),
      `POST ${url}`
    );
  }

  /**
   * PUT 请求
   */
  async put<T>(url: string, data?: any): Promise<T> {
    return this.requestWithRetry(
      () => this.client.put<T>(url, data),
      `PUT ${url}`
    );
  }

  /**
   * DELETE 请求
   */
  async delete<T>(url: string): Promise<T> {
    return this.requestWithRetry(
      () => this.client.delete<T>(url),
      `DELETE ${url}`
    );
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health');
      return true;
    } catch (error) {
      console.warn('Health check failed:', error);
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
   * 清空性能指标
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: ApiError): boolean {
    // 网络错误、超时错误、5xx服务器错误可重试
    return (
      !error.status || 
      error.status >= 500 || 
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED'
    );
  }

  /**
   * 转换错误格式
   */
  private transformError(error: any): ApiError {
    const apiError: ApiError = new Error(error.message || '请求失败') as ApiError;
    apiError.code = error.code;
    apiError.status = error.response?.status;
    apiError.response = error.response?.data;
    apiError.retryable = this.isRetryableError(apiError);
    return apiError;
  }

  /**
   * 记录性能指标
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
      requestId: this.generateRequestId(),
      service: 'api-client',
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
      },
    };

    this.metrics.push(metric);
    
    // 保持最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
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