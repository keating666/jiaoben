"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const circuit_breaker_1 = require("./circuit-breaker");
const logger_1 = require("./logger");
/**
 * 增强版API客户端
 * 包含断路器、限流、更好的错误处理等功能
 */
class EnhancedApiClient {
    constructor(config) {
        this.metrics = [];
        this.requestQueue = [];
        this.requestCounts = {
            minute: { count: 0, resetTime: Date.now() + 60000 },
            hour: { count: 0, resetTime: Date.now() + 3600000 },
        };
        this.config = config;
        // 初始化断路器
        this.circuitBreaker = new circuit_breaker_1.CircuitBreaker(config.circuitBreakerConfig || {
            failureThreshold: 5,
            resetTimeout: 60000,
            monitoringPeriod: 30000,
            requestTimeout: config.timeout,
        });
        // 创建axios实例
        this.client = axios_1.default.create({
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
    setupInterceptors() {
        // 请求拦截器
        this.client.interceptors.request.use((config) => {
            config.metadata = { startTime: Date.now() };
            // 添加请求ID
            config.headers['X-Request-ID'] = this.generateRequestId();
            return config;
        }, (error) => Promise.reject(error));
        // 响应拦截器
        this.client.interceptors.response.use((response) => {
            this.recordMetrics(response, true);
            return response;
        }, async (error) => {
            // 检查是否可以重试
            if (this.shouldRetryOnError(error)) {
                return this.handleRetryableError(error);
            }
            this.recordMetrics(error.response || error, false, error);
            return Promise.reject(this.transformError(error));
        });
    }
    /**
     * 执行带限流和断路器保护的请求
     */
    async requestWithProtection(requestFn, operation) {
        // 检查限流
        await this.checkRateLimit();
        // 使用断路器执行请求
        return this.circuitBreaker.execute(async () => {
            const response = await this.requestWithRetry(requestFn, operation);
            return response;
        }, operation);
    }
    /**
     * 执行带重试机制的请求（改进版）
     */
    async requestWithRetry(requestFn, operation) {
        const maxRetries = this.config.maxRetries || 3;
        const retryDelayBase = this.config.retryDelayBase || 1000;
        let lastError = new Error('No retry attempts were made');
        let attempt = 0;
        while (attempt <= maxRetries) {
            try {
                const response = await requestFn();
                return response.data;
            }
            catch (error) {
                lastError = error;
                // 如果是最后一次尝试或错误不可重试，直接抛出
                if (attempt === maxRetries || !this.isRetryableError(lastError)) {
                    throw lastError;
                }
                // 计算延迟时间（指数退避 + 抖动）
                const delay = this.calculateRetryDelay(attempt, retryDelayBase);
                logger_1.logger.warn('EnhancedApiClient', operation, `第 ${attempt + 1} 次重试失败，${delay}ms 后重试`, {
                    error: lastError.message,
                    statusCode: lastError.status,
                    attempt: attempt + 1,
                });
                await this.delay(delay);
                attempt++;
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    /**
     * 处理可重试的错误
     */
    async handleRetryableError(error) {
        const config = error.config;
        if (!config || !config.metadata) {
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
    async checkRateLimit() {
        if (!this.config.rateLimitConfig) {
            return;
        }
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
    calculateRetryDelay(attempt, baseDelay) {
        // 指数退避
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        // 添加抖动（0.5x 到 1.5x）
        const jitter = 0.5 + Math.random();
        return Math.min(exponentialDelay * jitter, 30000); // 最大延迟30秒
    }
    /**
     * 从响应头获取重试延迟时间
     */
    getRetryAfterHeader(response) {
        if (!response || !response.headers) {
            return null;
        }
        const retryAfter = response.headers['retry-after'];
        if (!retryAfter) {
            return null;
        }
        // 如果是数字，表示秒数
        const seconds = parseInt(retryAfter, 10);
        return isNaN(seconds) ? null : seconds;
    }
    /**
     * 判断错误是否应该重试
     */
    shouldRetryOnError(error) {
        var _a;
        // 如果有响应且状态码是429（限流），应该重试
        if (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 429) {
            return true;
        }
        return false;
    }
    /**
     * GET 请求
     */
    async get(url, params) {
        return this.requestWithProtection(() => this.client.get(url, { params }), `GET ${url}`);
    }
    /**
     * POST 请求
     */
    async post(url, data, config) {
        return this.requestWithProtection(() => this.client.post(url, data, config), `POST ${url}`);
    }
    /**
     * PUT 请求
     */
    async put(url, data) {
        return this.requestWithProtection(() => this.client.put(url, data), `PUT ${url}`);
    }
    /**
     * DELETE 请求
     */
    async delete(url) {
        return this.requestWithProtection(() => this.client.delete(url), `DELETE ${url}`);
    }
    /**
     * 健康检查（改进版）
     */
    async healthCheck(endpoint = '/health') {
        try {
            // 使用较短的超时时间进行健康检查
            const healthCheckClient = axios_1.default.create({
                baseURL: this.config.baseUrl,
                timeout: 5000,
                headers: this.client.defaults.headers,
            });
            await healthCheckClient.get(endpoint);
            logger_1.logger.info('EnhancedApiClient', 'healthCheck', '健康检查通过');
            return true;
        }
        catch (error) {
            logger_1.logger.warn('EnhancedApiClient', 'healthCheck', '健康检查失败', {
                error: error.message,
            });
            return false;
        }
    }
    /**
     * 获取性能指标
     */
    getMetrics() {
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
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
    /**
     * 判断错误是否可重试（增强版）
     */
    isRetryableError(error) {
        // 客户端错误通常不应重试（除了429）
        if (error.status && error.status >= 400 && error.status < 500) {
            return error.status === 429; // 只有限流错误可重试
        }
        // 网络错误、超时错误、5xx服务器错误可重试
        return (!error.status ||
            error.status >= 500 ||
            error.code === 'ECONNABORTED' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET');
    }
    /**
     * 转换错误格式（增强版）
     */
    transformError(error) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const apiError = new Error(((_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) ||
            ((_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) ||
            error.message ||
            '请求失败');
        apiError.code = error.code || ((_f = (_e = error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.code);
        apiError.status = (_g = error.response) === null || _g === void 0 ? void 0 : _g.status;
        apiError.response = (_h = error.response) === null || _h === void 0 ? void 0 : _h.data;
        apiError.retryable = this.isRetryableError(apiError);
        // 添加更多上下文信息
        if (error.config) {
            apiError.requestInfo = {
                method: error.config.method,
                url: error.config.url,
                baseURL: error.config.baseURL,
            };
        }
        return apiError;
    }
    /**
     * 记录性能指标（增强版）
     */
    recordMetrics(response, success, error) {
        var _a, _b, _c, _d, _e;
        const config = (response === null || response === void 0 ? void 0 : response.config) || response;
        const startTime = ((_a = config.metadata) === null || _a === void 0 ? void 0 : _a.startTime) || Date.now();
        const endTime = Date.now();
        const metric = {
            requestId: ((_b = config.headers) === null || _b === void 0 ? void 0 : _b['X-Request-ID']) || this.generateRequestId(),
            service: 'enhanced-api-client',
            operation: `${(_c = config.method) === null || _c === void 0 ? void 0 : _c.toUpperCase()} ${config.url}`,
            startTime,
            endTime,
            duration: endTime - startTime,
            success,
            error: error === null || error === void 0 ? void 0 : error.message,
            metadata: {
                status: response === null || response === void 0 ? void 0 : response.status,
                method: config.method,
                url: config.url,
                circuitBreakerState: this.circuitBreaker.getState(),
                retryCount: ((_d = config.metadata) === null || _d === void 0 ? void 0 : _d.retryCount) || 0,
            },
        };
        this.metrics.push(metric);
        // 保持最近2000条记录
        if (this.metrics.length > 2000) {
            this.metrics = this.metrics.slice(-2000);
        }
        // 记录慢请求
        if (metric.duration > 5000) {
            logger_1.logger.warn('EnhancedApiClient', 'recordMetrics', '检测到慢请求', {
                duration: metric.duration,
                operation: metric.operation,
                status: (_e = metric.metadata) === null || _e === void 0 ? void 0 : _e.status,
            });
        }
    }
    /**
     * 生成请求ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.EnhancedApiClient = EnhancedApiClient;
