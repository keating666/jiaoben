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

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    this.logLevel = logLevel;
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
    this.log(LogLevel.DEBUG, service, operation, message, data);
  }

  /**
   * 记录信息
   */
  info(service: string, operation: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, service, operation, message, data);
  }

  /**
   * 记录警告
   */
  warn(service: string, operation: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, service, operation, message, data);
  }

  /**
   * 记录错误
   */
  error(service: string, operation: string, message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, service, operation, message, data, error);
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
    }, metrics.error ? new Error(metrics.error) : undefined);
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
   * 核心日志记录方法
   */
  private log(
    level: LogLevel, 
    service: string, 
    operation: string, 
    message: string, 
    data?: any, 
    error?: Error
  ): void {
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

    this.logs.push(logEntry);

    // 保持最近5000条记录
    if (this.logs.length > 5000) {
      this.logs = this.logs.slice(-5000);
    }

    // 输出到控制台
    this.printToConsole(logEntry);
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
   * 清理敏感数据
   */
  private sanitizeData(data: any): any {
    if (!data) return data;
    
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // 移除或遮蔽敏感字段
    const sensitiveFields = ['api_key', 'apiKey', 'password', 'token', 'secret'];
    
    const sanitizeObject = (obj: any): void => {
      if (typeof obj !== 'object' || obj === null) return;
      
      Object.keys(obj).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '***MASKED***';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
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
}

// 创建全局日志实例
export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO
);