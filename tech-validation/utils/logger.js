"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = exports.LogLevel = void 0;
/**
 * 日志级别
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "debug";
    LogLevel["INFO"] = "info";
    LogLevel["WARN"] = "warn";
    LogLevel["ERROR"] = "error";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * 日志工具类
 */
class Logger {
    constructor(logLevel = LogLevel.INFO) {
        this.logs = [];
        this.logLock = false;
        this.disposed = false;
        this.maxLogSize = 5000;
        this.logLevel = logLevel;
        // 预编译敏感信息正则表达式
        this.sensitivePatterns = [
            /api[_-]?key/i,
            /password/i,
            /token/i,
            /secret/i,
            /authorization/i,
            /bearer/i,
            /credential/i,
        ];
    }
    /**
     * 设置日志级别
     */
    setLogLevel(level) {
        this.logLevel = level;
    }
    /**
     * 记录调试信息
     */
    debug(service, operation, message, data) {
        this.log(LogLevel.DEBUG, service, operation, message, data).catch(() => { });
    }
    /**
     * 记录信息
     */
    info(service, operation, message, data) {
        this.log(LogLevel.INFO, service, operation, message, data).catch(() => { });
    }
    /**
     * 记录警告
     */
    warn(service, operation, message, data) {
        this.log(LogLevel.WARN, service, operation, message, data).catch(() => { });
    }
    /**
     * 记录错误
     */
    error(service, operation, message, error, data) {
        this.log(LogLevel.ERROR, service, operation, message, data, error).catch(() => { });
    }
    /**
     * 记录性能指标
     */
    logMetrics(metrics) {
        const level = metrics.success ? LogLevel.INFO : LogLevel.ERROR;
        const message = `${metrics.operation} ${metrics.success ? '成功' : '失败'} (${metrics.duration}ms)`;
        this.log(level, metrics.service, metrics.operation, message, {
            duration: metrics.duration,
            success: metrics.success,
            metadata: metrics.metadata,
        }, metrics.error ? new Error(metrics.error) : undefined).catch(() => { });
    }
    /**
     * 获取所有日志
     */
    getLogs() {
        return [...this.logs];
    }
    /**
     * 获取指定级别的日志
     */
    getLogsByLevel(level) {
        return this.logs.filter((log) => log.level === level);
    }
    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = [];
    }
    /**
     * 导出日志为JSON
     */
    exportLogs() {
        return JSON.stringify(this.logs, null, 2);
    }
    /**
     * 打印日志摘要
     */
    printSummary() {
        const summary = this.logs.reduce((acc, log) => {
            acc[log.level] = (acc[log.level] || 0) + 1;
            return acc;
        }, {});
        console.log('\\n=== 日志摘要 ===');
        Object.entries(summary).forEach(([level, count]) => {
            console.log(`${level.toUpperCase()}: ${count} 条`);
        });
        const errors = this.getLogsByLevel(LogLevel.ERROR);
        if (errors.length > 0) {
            console.log('\\n=== 错误详情 ===');
            errors.forEach((error) => {
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
    async log(level, service, operation, message, data, error) {
        if (this.disposed) {
            return;
        }
        // 检查是否应该记录此级别的日志
        if (!this.shouldLog(level)) {
            return;
        }
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            service,
            operation,
            message,
            data: this.sanitizeData(data),
            error: error === null || error === void 0 ? void 0 : error.message,
            duration: data === null || data === void 0 ? void 0 : data.duration,
        };
        // 使用简单的锁机制避免并发问题
        while (this.logLock) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        this.logLock = true;
        try {
            this.logs.push(logEntry);
            // 使用循环缓冲区策略，避免频繁创建新数组
            if (this.logs.length > this.maxLogSize) {
                this.logs.splice(0, this.logs.length - this.maxLogSize);
            }
        }
        finally {
            this.logLock = false;
        }
        // 异步输出到控制台，避免阻塞
        // 在测试环境中同步输出，避免 "Cannot log after tests are done" 错误
        if (process.env.NODE_ENV === 'test') {
            this.printToConsole(logEntry);
        }
        else {
            setImmediate(() => this.printToConsole(logEntry));
        }
    }
    /**
     * 判断是否应该记录此级别的日志
     */
    shouldLog(level) {
        const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const targetLevelIndex = levels.indexOf(level);
        return targetLevelIndex >= currentLevelIndex;
    }
    /**
     * 清理敏感数据（优化版）
     */
    sanitizeData(data) {
        if (!data) {
            return data;
        }
        // 对于简单类型，直接返回
        if (typeof data !== 'object') {
            return data;
        }
        // 使用更高效的方法进行浅拷贝
        const sanitized = Array.isArray(data) ? [...data] : Object.assign({}, data);
        const sanitizeObject = (obj, depth = 0) => {
            // 限制递归深度，防止栈溢出
            if (depth > 10 || typeof obj !== 'object' || obj === null) {
                return;
            }
            Object.keys(obj).forEach((key) => {
                // 使用预编译的正则表达式检查敏感字段
                if (this.sensitivePatterns.some((pattern) => pattern.test(key))) {
                    obj[key] = '***MASKED***';
                }
                else if (typeof obj[key] === 'object') {
                    // 对于嵌套对象，创建新的副本
                    if (Array.isArray(obj[key])) {
                        obj[key] = [...obj[key]];
                    }
                    else {
                        obj[key] = Object.assign({}, obj[key]);
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
    printToConsole(logEntry) {
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
    dispose() {
        this.disposed = true;
        this.logs = [];
    }
}
exports.Logger = Logger;
// 创建全局日志实例
exports.logger = new Logger(process.env.LOG_LEVEL || LogLevel.INFO);
