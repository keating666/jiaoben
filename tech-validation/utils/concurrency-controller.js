"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConcurrencyController = void 0;
/**
 * 并发控制器 - 限制同时处理的请求数量
 * 防止资源耗尽和系统过载
 */
class ConcurrencyController {
    constructor(maxConcurrent = 5) {
        this.activeRequests = new Map();
        this.queue = [];
        if (maxConcurrent < 1) {
            throw new Error('maxConcurrent must be at least 1');
        }
        this.maxConcurrent = maxConcurrent;
    }
    /**
     * 执行操作，如果达到并发限制则排队等待
     */
    async execute(sessionId, operation) {
        // 如果已达到并发限制，加入队列等待
        if (this.activeRequests.size >= this.maxConcurrent) {
            return new Promise((resolve, reject) => {
                this.queue.push({ sessionId, operation, resolve, reject });
            });
        }
        // 执行操作
        return this.executeOperation(sessionId, operation);
    }
    async executeOperation(sessionId, operation) {
        const promise = operation().finally(() => {
            // 操作完成后，从活跃列表中移除
            this.activeRequests.delete(sessionId);
            // 处理队列中的下一个请求
            this.processQueue();
        });
        this.activeRequests.set(sessionId, promise);
        return promise;
    }
    async processQueue() {
        if (this.queue.length === 0 || this.activeRequests.size >= this.maxConcurrent) {
            return;
        }
        const next = this.queue.shift();
        if (!next) {
            return;
        }
        try {
            const result = await this.executeOperation(next.sessionId, next.operation);
            next.resolve(result);
        }
        catch (error) {
            next.reject(error);
        }
    }
    /**
     * 获取当前活跃的请求数
     */
    getActiveCount() {
        return this.activeRequests.size;
    }
    /**
     * 获取队列中等待的请求数
     */
    getQueueLength() {
        return this.queue.length;
    }
    /**
     * 获取指定会话是否正在处理
     */
    isActive(sessionId) {
        return this.activeRequests.has(sessionId);
    }
    /**
     * 取消队列中的请求（不会取消正在执行的请求）
     */
    cancelQueued(sessionId) {
        const index = this.queue.findIndex((item) => item.sessionId === sessionId);
        if (index !== -1) {
            const [cancelled] = this.queue.splice(index, 1);
            cancelled.reject(new Error('Request cancelled'));
            return true;
        }
        return false;
    }
    /**
     * 获取系统状态报告
     */
    getStatus() {
        return {
            maxConcurrent: this.maxConcurrent,
            activeCount: this.activeRequests.size,
            queueLength: this.queue.length,
            activeSessions: Array.from(this.activeRequests.keys()),
            queuedSessions: this.queue.map((item) => item.sessionId),
        };
    }
}
exports.ConcurrencyController = ConcurrencyController;
