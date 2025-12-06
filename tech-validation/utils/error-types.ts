/**
 * 基础错误类型系统
 * 提供详细的错误分类和上下文信息
 */

// 基础错误类
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly timestamp: string;
  public readonly context?: Record<string, any>;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly cause?: Error;

  constructor(
    code: string,
    message: string,
    userMessage: string,
    retryable: boolean = false,
    context?: Record<string, any>,
    cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.context = context;
    this.retryable = retryable;
    this.userMessage = userMessage;
    this.cause = cause;
    
    // 保持原始堆栈跟踪
    if (cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      timestamp: this.timestamp,
      retryable: this.retryable,
      context: this.context,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

// ============= 网络相关错误 =============
export class NetworkError extends BaseError {
  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(
      'NETWORK_ERROR',
      message,
      '网络连接出现问题，请检查网络后重试',
      true,
      context,
      cause,
    );
  }
}

export class TimeoutError extends BaseError {
  constructor(operation: string, timeoutMs: number, context?: Record<string, any>) {
    super(
      'TIMEOUT_ERROR',
      `操作超时: ${operation} (${timeoutMs}ms)`,
      '处理时间过长，请稍后重试',
      true,
      { ...context, operation, timeoutMs },
    );
  }
}

// ============= 服务相关错误 =============
export class ServiceError extends BaseError {
  public readonly service: string;
  public readonly statusCode?: number;

  constructor(
    code: string,
    service: string,
    message: string,
    userMessage: string,
    statusCode?: number,
    retryable: boolean = true,
    context?: Record<string, any>,
    cause?: Error,
  ) {
    super(
      code,
      message,
      userMessage,
      retryable,
      { ...context, service, statusCode },
      cause,
    );
    this.service = service;
    this.statusCode = statusCode;
  }
}

export class ServiceUnavailableError extends ServiceError {
  constructor(service: string, reason?: string, context?: Record<string, any>) {
    super(
      'SERVICE_UNAVAILABLE',
      service,
      `服务不可用: ${service}${reason ? ` - ${reason}` : ''}`,
      '服务暂时不可用，正在为您切换备用服务',
      503,
      true,
      context,
    );
  }
}

export class RateLimitError extends ServiceError {
  public readonly retryAfter?: number;

  constructor(service: string, retryAfter?: number, context?: Record<string, any>) {
    super(
      'RATE_LIMIT_ERROR',
      service,
      'API请求频率超限',
      '请求过于频繁，请稍后再试',
      429,
      true,
      { ...context, retryAfter },
    );
    this.retryAfter = retryAfter;
  }
}

export class QuotaExceededError extends ServiceError {
  constructor(service: string, quotaType: string, context?: Record<string, any>) {
    super(
      'QUOTA_EXCEEDED',
      service,
      `配额已用完: ${quotaType}`,
      '今日配额已用完，请明天再试或联系管理员',
      429,
      false,
      { ...context, quotaType },
    );
  }
}

// ============= 认证相关错误 =============
export class AuthenticationError extends BaseError {
  constructor(service: string, reason?: string, context?: Record<string, any>) {
    super(
      'AUTH_ERROR',
      `认证失败: ${service}${reason ? ` - ${reason}` : ''}`,
      '认证失败，请检查API密钥配置',
      false,
      { ...context, service },
    );
  }
}

export class ApiKeyInvalidError extends BaseError {
  constructor(service: string, context?: Record<string, any>) {
    super(
      'INVALID_API_KEY',
      `认证失败: ${service} - API密钥无效或已过期`,
      'API密钥无效或已过期',
      false,
      { ...context, service },
    );
  }
}

// ============= 数据相关错误 =============
export class ValidationError extends BaseError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any, context?: Record<string, any>) {
    super(
      'VALIDATION_ERROR',
      message,
      '输入数据格式有误，请检查后重试',
      false,
      { ...context, field, value },
    );
    this.field = field;
    this.value = value;
  }
}

export class ParseError extends BaseError {
  constructor(dataType: string, reason?: string, context?: Record<string, any>, cause?: Error) {
    super(
      'PARSE_ERROR',
      `解析${dataType}失败${reason ? `: ${reason}` : ''}`,
      '数据解析失败，请检查输入格式',
      false,
      { ...context, dataType },
      cause,
    );
  }
}

// ============= 业务逻辑错误 =============
export class BusinessError extends BaseError {
  constructor(code: string, message: string, userMessage: string, context?: Record<string, any>, cause?: Error) {
    super(code, message, userMessage, false, context, cause);
  }
}

export class VideoNotFoundError extends BusinessError {
  constructor(videoId: string, platform: string, context?: Record<string, any>) {
    super(
      'VIDEO_NOT_FOUND',
      `视频不存在: ${videoId}`,
      '视频不存在或已被删除',
      { ...context, videoId, platform },
    );
  }
}

export class VideoProcessingError extends BusinessError {
  constructor(stage: string, reason: string, context?: Record<string, any>, cause?: Error) {
    super(
      'VIDEO_PROCESSING_ERROR',
      `视频处理失败 [${stage}]: ${reason}`,
      '视频处理失败，请稍后重试',
      { ...context, stage },
      cause,
    );
  }
}

export class TranscriptionError extends BusinessError {
  constructor(reason: string, context?: Record<string, any>, cause?: Error) {
    super(
      'TRANSCRIPTION_ERROR',
      `转录失败: ${reason}`,
      '音频转文字失败，请检查视频是否包含有效音频',
      context,
      cause,
    );
  }
}

// ============= 系统错误 =============
export class SystemError extends BaseError {
  constructor(message: string, context?: Record<string, any>, cause?: Error) {
    super(
      'SYSTEM_ERROR',
      message,
      '系统内部错误，请联系技术支持',
      true,
      context,
      cause,
    );
  }
}

export class ResourceExhaustedError extends BaseError {
  constructor(resource: string, context?: Record<string, any>) {
    super(
      'RESOURCE_EXHAUSTED',
      `资源耗尽: ${resource}`,
      '系统资源不足，请稍后重试',
      true,
      { ...context, resource },
    );
  }
}

// ============= 错误处理工具 =============
export class ErrorHandler {
  /**
   * 判断错误是否可重试
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.retryable;
    }
    
    // 检查常见的可重试错误
    const retryableMessages = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'socket hang up',
    ];
    
    return retryableMessages.some((msg) => 
      error.message.includes(msg) || error.message.includes(msg),
    );
  }

  /**
   * 获取用户友好的错误消息
   */
  static getUserMessage(error: Error): string {
    if (error instanceof BaseError) {
      return error.userMessage;
    }
    
    // 默认消息
    return '处理请求时出现错误，请稍后重试';
  }

  /**
   * 获取重试延迟时间（毫秒）
   */
  static getRetryDelay(error: Error, attempt: number): number {
    // 如果是限流错误，使用服务端指定的时间
    if (error instanceof RateLimitError && error.retryAfter) {
      return error.retryAfter * 1000;
    }
    
    // 指数退避策略
    const baseDelay = 1000; // 1秒
    const maxDelay = 60000; // 60秒
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // 添加随机抖动（±20%）
    const jitter = delay * 0.2 * (Math.random() - 0.5);

    return Math.floor(delay + jitter);
  }

  /**
   * 记录错误日志
   */
  static logError(error: Error, context?: Record<string, any>): void {
    const errorInfo = {
      timestamp: new Date().toISOString(),
      error: error instanceof BaseError ? error.toJSON() : {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
    };
    
    // 根据错误级别使用不同的日志级别
    if (error instanceof SystemError) {
      console.error('[CRITICAL]', errorInfo);
    } else if (error instanceof ServiceError) {
      console.warn('[SERVICE]', errorInfo);
    } else {
      console.error('[ERROR]', errorInfo);
    }
  }
}