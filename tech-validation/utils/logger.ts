import { PerformanceMetrics } from '../interfaces/api-types';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  operation: string;
  message: string;
  data?: any;
  error?: string;
  duration?: number;
}

/**
 * 日志工具类
 */
export class Logger {
  private logs: LogEntry[] = [];
  private logLevel: LogLevel;
  private logLock = false;
  private disposed = false;
  private maxLogSize = 5000;
  private sensitivePatterns: RegExp[];

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
    // 预编译敏感信息正则表达式
    this.sensitivePatterns = [
      /api[_-]?key/i,
      /password/i,
      /token/i,
      /secret/i,
      /authorization/i,
      /bearer/i,
      /credential/i
    ];
  }

  /**
   * 设置日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * 记录调试信息
   */
  debug(service: string, operation: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, service, operation, message, data).catch(() => {});
  }

  /**
   * 记录信息
   */
  info(service: string, operation: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, service, operation, message, data).catch(() => {});
  }

  /**
   * 记录警告
   */
  warn(service: string, operation: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, service, operation, message, data).catch(() => {});
  }

  /**
   * 记录错误
   */
  error(service: string, operation: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, service, operation, message, data, error).catch(() => {});
  }

  /**
   * 记录性能指标
   */
  logMetrics(metrics: PerformanceMetrics): void {
    const level = metrics.success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `${metrics.operation} ${metrics.success ? '成功' : '失败'} (${metrics.duration}ms)`;
    
    this.log(level, metrics.service, metrics.operation, message, {
      duration: metrics.duration,
      success: metrics.success,
      metadata: metrics.metadata
    }, metrics.error ? new Error(metrics.error) : undefined).catch(() => {});
  }

  /**
   * 获取所有日志
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 获取指定级别的日志
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * 清空日志
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * 导出日志为JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * 打印日志摘要
   */
  printSummary(): void {
    const summary = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\\n=== 日志摘要 ===');
    Object.entries(summary).forEach(([level, count]) => {
      console.log(`${level.toUpperCase()}: ${count} 条`);
    });

    const errors = this.getLogsByLevel(LogLevel.ERROR);
    if (errors.length > 0) {
      console.log('\\n=== 错误详情 ===');
      errors.forEach(error => {
        console.log(`[${error.timestamp}] ${error.service}:${error.operation} - ${error.message}`);
        if (error.error) {
          console.log(`  错误: ${error.error}`);
        }
      });
    }
  }

  /**
   * 核心日志记录方法（线程安全版本）
   */
  private async log(
    level: LogLevel, 
    service: string, 
    operation: string, 
    message: string, 
    data?: any, 
    error?: Error
  ): Promise<void> {
    if (this.disposed) return;
    
    // 检查是否应该记录此级别的日志
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      operation,
      message,
      data: this.sanitizeData(data),
      error: error?.message,
      duration: data?.duration,
    };

    // 使用简单的锁机制避免并发问题
    while (this.logLock) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    this.logLock = true;
    try {
      this.logs.push(logEntry);

      // 使用循环缓冲区策略，避免频繁创建新数组
      if (this.logs.length > this.maxLogSize) {
        this.logs.splice(0, this.logs.length - this.maxLogSize);
      }
    } finally {
      this.logLock = false;
    }

    // 异步输出到控制台，避免阻塞
    setImmediate(() => this.printToConsole(logEntry));
  }

  /**
   * 判断是否应该记录此级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  /**
   * 清理敏感数据（优化版）
   */
  private sanitizeData(data: any): any {
    if (!data) return data;
    
    // 对于简单类型，直接返回
    if (typeof data !== 'object') return data;
    
    // 使用更高效的方法进行浅拷贝
    const sanitized = Array.isArray(data) ? [...data] : { ...data };
    
    const sanitizeObject = (obj: any, depth: number = 0): void => {
      // 限制递归深度，防止栈溢出
      if (depth > 10 || typeof obj !== 'object' || obj === null) return;
      
      Object.keys(obj).forEach(key => {
        // 使用预编译的正则表达式检查敏感字段
        if (this.sensitivePatterns.some(pattern => pattern.test(key))) {
          obj[key] = '***MASKED***';
        } else if (typeof obj[key] === 'object') {
          // 对于嵌套对象，创建新的副本
          if (Array.isArray(obj[key])) {
            obj[key] = [...obj[key]];
          } else {
            obj[key] = { ...obj[key] };
          }
          sanitizeObject(obj[key], depth + 1);
        }
      });
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * 输出到控制台
   */
  private printToConsole(logEntry: LogEntry): void {
    const timestamp = new Date(logEntry.timestamp).toLocaleString();
    const prefix = `[${timestamp}] [${logEntry.level.toUpperCase()}] ${logEntry.service}:${logEntry.operation}`;
    
    switch (logEntry.level) {
      case LogLevel.ERROR:
        console.error(`${prefix} - ${logEntry.message}`, logEntry.error ? `\\nError: ${logEntry.error}` : '');
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} - ${logEntry.message}`);
        break;
      case LogLevel.DEBUG:
        console.debug(`${prefix} - ${logEntry.message}`, logEntry.data ? logEntry.data : '');
        break;
      default:
        console.log(`${prefix} - ${logEntry.message}`);
    }
  }

  /**
   * 销毁日志器，释放资源
   */
  dispose(): void {
    this.disposed = true;
    this.logs = [];
  }
}

// 创建全局日志实例
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO
);