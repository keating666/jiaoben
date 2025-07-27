"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoring = exports.MonitoringService = void 0;
exports.Monitor = Monitor;
const events_1 = require("events");
class MonitoringService extends events_1.EventEmitter {
    constructor(samplingConfig) {
        super();
        this.metrics = new Map();
        this.spans = new Map();
        this.metricsBuffer = [];
        this.samplingConfig = Object.assign({ rate: 0.1, alwaysSample: ['error', 'api_call', 'video_process'], neverSample: ['health_check'] }, samplingConfig);
        // 定期刷新指标（批量处理提高性能）
        this.flushInterval = setInterval(() => this.flushMetrics(), 5000);
    }
    /**
     * 记录关键业务指标
     */
    recordMetric(name, value, tags) {
        if (!this.shouldSample(name))
            return;
        const metric = {
            name,
            value,
            timestamp: Date.now(),
            tags
        };
        this.metricsBuffer.push(metric);
    }
    /**
     * 开始跟踪操作
     */
    startSpan(operationName, tags, parentId) {
        if (!this.shouldSample(operationName)) {
            return 'no-op-span';
        }
        const span = {
            id: this.generateSpanId(),
            operationName,
            startTime: Date.now(),
            tags: tags || {},
            status: 'running',
            parentId
        };
        this.spans.set(span.id, span);
        return span.id;
    }
    /**
     * 结束跟踪操作
     */
    endSpan(spanId, status = 'success', error) {
        if (spanId === 'no-op-span')
            return;
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = status;
        span.error = error;
        // 发送span数据
        this.emit('span', span);
        // 记录性能指标
        this.recordMetric(`${span.operationName}.duration`, span.duration, Object.assign({ status }, span.tags));
        // 清理内存（防止泄漏）
        if (this.spans.size > 1000) {
            this.cleanupOldSpans();
        }
    }
    /**
     * 记录错误（带上下文）
     */
    recordError(error, context) {
        this.recordMetric('error.count', 1, Object.assign({ error_type: error.name, error_code: error.code || 'UNKNOWN' }, context));
        // 错误总是记录（不受采样影响）
        this.emit('error', { error, context, timestamp: Date.now() });
    }
    /**
     * 获取实时指标
     */
    getMetrics(name, duration = 60000) {
        const now = Date.now();
        const metrics = this.metrics.get(name) || [];
        return metrics.filter(m => now - m.timestamp <= duration);
    }
    /**
     * 获取操作统计
     */
    getOperationStats(operationName) {
        const metrics = this.getMetrics(`${operationName}.duration`);
        if (metrics.length === 0) {
            return { count: 0, avgDuration: 0, p95Duration: 0, successRate: 0 };
        }
        const durations = metrics.map(m => m.value).sort((a, b) => a - b);
        const successCount = metrics.filter(m => { var _a; return ((_a = m.tags) === null || _a === void 0 ? void 0 : _a.status) === 'success'; }).length;
        return {
            count: metrics.length,
            avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
            successRate: successCount / metrics.length
        };
    }
    /**
     * 健康检查指标
     */
    getHealthMetrics() {
        const errorMetrics = this.getMetrics('error.count', 300000); // 5分钟
        const durationMetrics = this.getMetrics('video_process.duration', 300000);
        return {
            uptime: process.uptime(),
            errorRate: errorMetrics.length,
            avgResponseTime: durationMetrics.length > 0
                ? durationMetrics.reduce((a, b) => a + b.value, 0) / durationMetrics.length
                : 0,
            activeSpans: Array.from(this.spans.values()).filter(s => s.status === 'running').length
        };
    }
    // ========== 私有方法 ==========
    shouldSample(operationName) {
        // 总是采样的操作
        if (this.samplingConfig.alwaysSample.some(op => operationName.includes(op))) {
            return true;
        }
        // 从不采样的操作
        if (this.samplingConfig.neverSample.some(op => operationName.includes(op))) {
            return false;
        }
        // 基于采样率的随机采样
        return Math.random() < this.samplingConfig.rate;
    }
    generateSpanId() {
        return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    flushMetrics() {
        if (this.metricsBuffer.length === 0)
            return;
        // 批量处理指标
        this.metricsBuffer.forEach(metric => {
            if (!this.metrics.has(metric.name)) {
                this.metrics.set(metric.name, []);
            }
            const metricArray = this.metrics.get(metric.name);
            metricArray.push(metric);
            // 保留最近1小时的数据
            const oneHourAgo = Date.now() - 3600000;
            const filtered = metricArray.filter(m => m.timestamp > oneHourAgo);
            this.metrics.set(metric.name, filtered);
        });
        // 发送批量指标事件
        this.emit('metrics', this.metricsBuffer);
        // 清空缓冲区
        this.metricsBuffer = [];
    }
    cleanupOldSpans() {
        const oneHourAgo = Date.now() - 3600000;
        const toDelete = [];
        this.spans.forEach((span, id) => {
            if (span.endTime && span.endTime < oneHourAgo) {
                toDelete.push(id);
            }
        });
        toDelete.forEach(id => this.spans.delete(id));
    }
    /**
     * 清理资源
     */
    dispose() {
        clearInterval(this.flushInterval);
        this.flushMetrics();
        this.removeAllListeners();
    }
}
exports.MonitoringService = MonitoringService;
/**
 * 关键监控点定义
 */
MonitoringService.MonitoringPoints = {
    // API调用监控点
    API_CALL: {
        TikHub: ['resolve_video', 'parse_response'],
        Yunmao: ['create_task', 'wait_completion', 'get_result'],
        TongYi: ['generate_script', 'parse_response']
    },
    // 业务流程监控点
    BUSINESS: {
        VideoProcess: ['link_extract', 'url_resolve', 'transcribe', 'script_generate'],
        ErrorHandle: ['retry_attempt', 'fallback_trigger', 'error_logged']
    },
    // 系统资源监控点
    SYSTEM: {
        Memory: ['heap_used', 'heap_total'],
        Request: ['concurrent_count', 'queue_size']
    }
};
// 单例实例
exports.monitoring = new MonitoringService({
    rate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    alwaysSample: ['error', 'api_call', 'video_process', 'fallback_trigger']
});
// 装饰器：自动监控方法执行
function Monitor(operationName) {
    return function (target, propertyName, descriptor) {
        const originalMethod = descriptor.value;
        const opName = operationName || `${target.constructor.name}.${propertyName}`;
        descriptor.value = async function (...args) {
            const spanId = exports.monitoring.startSpan(opName, {
                class: target.constructor.name,
                method: propertyName
            });
            try {
                const result = await originalMethod.apply(this, args);
                exports.monitoring.endSpan(spanId, 'success');
                return result;
            }
            catch (error) {
                exports.monitoring.endSpan(spanId, 'error', error);
                exports.monitoring.recordError(error, {
                    class: target.constructor.name,
                    method: propertyName
                });
                throw error;
            }
        };
        return descriptor;
    };
}
