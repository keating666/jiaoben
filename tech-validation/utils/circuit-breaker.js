"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitState = void 0;
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    constructor(config) {
        this.config = config;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.stateLock = false;
        this.halfOpenRequests = 0;
        this.maxHalfOpenRequests = 1;
        // 使用 performance.now() 替代 Date.now() 以获得更高精度
        if (typeof performance !== 'undefined' && performance.now) {
            this.getTime = () => performance.now();
        }
        else {
            this.getTime = () => Date.now();
        }
    }
    /**
     * 执行请求并管理断路器状态（线程安全版本）
     */
    async execute(operation, operationName) {
        // 获取当前状态的快照
        const currentState = await this.getStateAtomic();
        // 检查断路器状态
        if (currentState === CircuitState.OPEN) {
            const now = this.getTime();
            if (now < this.nextAttemptTime) {
                throw new Error(`断路器开启: ${operationName} 暂时不可用`);
            }
            // 尝试进入半开状态
            const transitioned = await this.transitionToHalfOpen();
            if (!transitioned) {
                throw new Error(`断路器开启: ${operationName} 暂时不可用`);
            }
        }
        // 半开状态下限制并发请求
        if (this.state === CircuitState.HALF_OPEN) {
            if (this.halfOpenRequests >= this.maxHalfOpenRequests) {
                throw new Error(`断路器半开状态: ${operationName} 请求已达上限`);
            }
            this.halfOpenRequests++;
        }
        try {
            const result = await this.executeWithTimeout(operation);
            // 成功执行
            await this.onSuccess();
            return result;
        }
        catch (error) {
            // 执行失败
            await this.onFailure();
            throw error;
        }
        finally {
            if (this.state === CircuitState.HALF_OPEN) {
                this.halfOpenRequests--;
            }
        }
    }
    /**
     * 获取断路器当前状态
     */
    getState() {
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
            lastFailureTime: this.lastFailureTime,
        };
    }
    /**
     * 重置断路器
     */
    reset() {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = undefined;
        this.nextAttemptTime = undefined;
    }
    /**
     * 执行操作并设置超时
     */
    async executeWithTimeout(operation) {
        if (!this.config.requestTimeout) {
            return operation();
        }
        return Promise.race([
            operation(),
            new Promise((_resolve, reject) => setTimeout(() => reject(new Error('请求超时')), this.config.requestTimeout)),
        ]);
    }
    /**
     * 原子获取状态
     */
    async getStateAtomic() {
        while (this.stateLock) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        return this.state;
    }
    /**
     * 尝试转换到半开状态
     */
    async transitionToHalfOpen() {
        while (this.stateLock) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        this.stateLock = true;
        try {
            if (this.state === CircuitState.OPEN && this.getTime() >= this.nextAttemptTime) {
                this.state = CircuitState.HALF_OPEN;
                this.halfOpenRequests = 0;
                return true;
            }
            return false;
        }
        finally {
            this.stateLock = false;
        }
    }
    /**
     * 处理成功情况（线程安全版本）
     */
    async onSuccess() {
        while (this.stateLock) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        this.stateLock = true;
        try {
            if (this.state === CircuitState.HALF_OPEN) {
                // 半开状态下成功，重置断路器
                this.reset();
            }
            else {
                this.successCount++;
                // 在监控周期内重置失败计数
                if (this.shouldResetCounters()) {
                    this.failureCount = 0;
                    this.successCount = 1;
                }
            }
        }
        finally {
            this.stateLock = false;
        }
    }
    /**
     * 处理失败情况（线程安全版本）
     */
    async onFailure() {
        while (this.stateLock) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        this.stateLock = true;
        try {
            this.failureCount++;
            this.lastFailureTime = this.getTime();
            if (this.state === CircuitState.HALF_OPEN) {
                // 半开状态失败，重新打开断路器
                this.openCircuit();
            }
            else if (this.failureCount >= this.config.failureThreshold) {
                // 达到失败阈值，打开断路器
                this.openCircuit();
            }
        }
        finally {
            this.stateLock = false;
        }
    }
    /**
     * 打开断路器
     */
    openCircuit() {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = this.getTime() + this.config.resetTimeout;
        this.halfOpenRequests = 0;
    }
    /**
     * 检查是否应该重置计数器
     */
    shouldResetCounters() {
        if (!this.lastFailureTime) {
            return false;
        }
        return this.getTime() - this.lastFailureTime > this.config.monitoringPeriod;
    }
}
exports.CircuitBreaker = CircuitBreaker;
