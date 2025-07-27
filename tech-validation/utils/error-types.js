"use strict";
/**
 * 基础错误类型系统
 * 提供详细的错误分类和上下文信息
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.ResourceExhaustedError = exports.SystemError = exports.TranscriptionError = exports.VideoProcessingError = exports.VideoNotFoundError = exports.BusinessError = exports.ParseError = exports.ValidationError = exports.ApiKeyInvalidError = exports.AuthenticationError = exports.QuotaExceededError = exports.RateLimitError = exports.ServiceUnavailableError = exports.ServiceError = exports.TimeoutError = exports.NetworkError = exports.BaseError = void 0;
// 基础错误类
class BaseError extends Error {
    constructor(code, message, userMessage, retryable = false, context, cause) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.timestamp = new Date().toISOString();
        this.context = context;
        this.retryable = retryable;
        this.userMessage = userMessage;
        this.cause = cause;
        // 保持原始堆栈跟踪
        if (cause === null || cause === void 0 ? void 0 : cause.stack) {
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
            stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
        };
    }
}
exports.BaseError = BaseError;
// ============= 网络相关错误 =============
class NetworkError extends BaseError {
    constructor(message, context, cause) {
        super('NETWORK_ERROR', message, '网络连接出现问题，请检查网络后重试', true, context, cause);
    }
}
exports.NetworkError = NetworkError;
class TimeoutError extends NetworkError {
    constructor(operation, timeoutMs, context) {
        super(`操作超时: ${operation} (${timeoutMs}ms)`, Object.assign(Object.assign({}, context), { operation, timeoutMs }));
        this.code = 'TIMEOUT_ERROR';
        this.userMessage = '处理时间过长，请稍后重试';
    }
}
exports.TimeoutError = TimeoutError;
// ============= 服务相关错误 =============
class ServiceError extends BaseError {
    constructor(service, message, statusCode, retryable = true, context, cause) {
        super('SERVICE_ERROR', message, '服务暂时不可用，正在为您切换备用服务', retryable, Object.assign(Object.assign({}, context), { service, statusCode }), cause);
        this.service = service;
        this.statusCode = statusCode;
    }
}
exports.ServiceError = ServiceError;
class ServiceUnavailableError extends ServiceError {
    constructor(service, reason, context) {
        super(service, `服务不可用: ${service}${reason ? ` - ${reason}` : ''}`, 503, true, context);
        this.code = 'SERVICE_UNAVAILABLE';
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
class RateLimitError extends ServiceError {
    constructor(service, retryAfter, context) {
        super(service, `API请求频率超限`, 429, true, Object.assign(Object.assign({}, context), { retryAfter }));
        this.code = 'RATE_LIMIT_ERROR';
        this.userMessage = '请求过于频繁，请稍后再试';
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
class QuotaExceededError extends ServiceError {
    constructor(service, quotaType, context) {
        super(service, `配额已用完: ${quotaType}`, 429, false, Object.assign(Object.assign({}, context), { quotaType }));
        this.code = 'QUOTA_EXCEEDED';
        this.userMessage = '今日配额已用完，请明天再试或联系管理员';
    }
}
exports.QuotaExceededError = QuotaExceededError;
// ============= 认证相关错误 =============
class AuthenticationError extends BaseError {
    constructor(service, reason, context) {
        super('AUTH_ERROR', `认证失败: ${service}${reason ? ` - ${reason}` : ''}`, '认证失败，请检查API密钥配置', false, Object.assign(Object.assign({}, context), { service }));
    }
}
exports.AuthenticationError = AuthenticationError;
class ApiKeyInvalidError extends AuthenticationError {
    constructor(service, context) {
        super(service, 'API密钥无效或已过期', context);
        this.code = 'INVALID_API_KEY';
    }
}
exports.ApiKeyInvalidError = ApiKeyInvalidError;
// ============= 数据相关错误 =============
class ValidationError extends BaseError {
    constructor(message, field, value, context) {
        super('VALIDATION_ERROR', message, '输入数据格式有误，请检查后重试', false, Object.assign(Object.assign({}, context), { field, value }));
        this.field = field;
        this.value = value;
    }
}
exports.ValidationError = ValidationError;
class ParseError extends BaseError {
    constructor(dataType, reason, context, cause) {
        super('PARSE_ERROR', `解析${dataType}失败${reason ? `: ${reason}` : ''}`, '数据解析失败，请检查输入格式', false, Object.assign(Object.assign({}, context), { dataType }), cause);
    }
}
exports.ParseError = ParseError;
// ============= 业务逻辑错误 =============
class BusinessError extends BaseError {
    constructor(code, message, userMessage, context) {
        super(code, message, userMessage, false, context);
    }
}
exports.BusinessError = BusinessError;
class VideoNotFoundError extends BusinessError {
    constructor(videoId, platform, context) {
        super('VIDEO_NOT_FOUND', `视频不存在: ${videoId}`, '视频不存在或已被删除', Object.assign(Object.assign({}, context), { videoId, platform }));
    }
}
exports.VideoNotFoundError = VideoNotFoundError;
class VideoProcessingError extends BusinessError {
    constructor(stage, reason, context, cause) {
        super('VIDEO_PROCESSING_ERROR', `视频处理失败 [${stage}]: ${reason}`, '视频处理失败，请稍后重试', Object.assign(Object.assign({}, context), { stage }));
        this.cause = cause;
    }
}
exports.VideoProcessingError = VideoProcessingError;
class TranscriptionError extends BusinessError {
    constructor(reason, context, cause) {
        super('TRANSCRIPTION_ERROR', `转录失败: ${reason}`, '音频转文字失败，请检查视频是否包含有效音频', context);
        this.cause = cause;
    }
}
exports.TranscriptionError = TranscriptionError;
// ============= 系统错误 =============
class SystemError extends BaseError {
    constructor(message, context, cause) {
        super('SYSTEM_ERROR', message, '系统内部错误，请联系技术支持', true, context, cause);
    }
}
exports.SystemError = SystemError;
class ResourceExhaustedError extends SystemError {
    constructor(resource, context) {
        super(`资源耗尽: ${resource}`, Object.assign(Object.assign({}, context), { resource }));
        this.code = 'RESOURCE_EXHAUSTED';
        this.userMessage = '系统资源不足，请稍后重试';
    }
}
exports.ResourceExhaustedError = ResourceExhaustedError;
// ============= 错误处理工具 =============
class ErrorHandler {
    /**
     * 判断错误是否可重试
     */
    static isRetryable(error) {
        if (error instanceof BaseError) {
            return error.retryable;
        }
        // 检查常见的可重试错误
        const retryableMessages = [
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'ENETUNREACH',
            'socket hang up'
        ];
        return retryableMessages.some(msg => error.message.includes(msg) || error.message.includes(msg));
    }
    /**
     * 获取用户友好的错误消息
     */
    static getUserMessage(error) {
        if (error instanceof BaseError) {
            return error.userMessage;
        }
        // 默认消息
        return '处理请求时出现错误，请稍后重试';
    }
    /**
     * 获取重试延迟时间（毫秒）
     */
    static getRetryDelay(error, attempt) {
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
    static logError(error, context) {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            error: error instanceof BaseError ? error.toJSON() : {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            context
        };
        // 根据错误级别使用不同的日志级别
        if (error instanceof SystemError) {
            console.error('[CRITICAL]', errorInfo);
        }
        else if (error instanceof ServiceError) {
            console.warn('[SERVICE]', errorInfo);
        }
        else {
            console.error('[ERROR]', errorInfo);
        }
    }
}
exports.ErrorHandler = ErrorHandler;
