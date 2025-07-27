"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YunmaoClient = void 0;
const enhanced_api_client_1 = require("../utils/enhanced-api-client");
const logger_1 = require("../utils/logger");
const security_validator_1 = require("../utils/security-validator");
/**
 * 云猫转码客户端
 * 用于调用云猫转码的视频转文字API
 */
class YunmaoClient {
    constructor(config) {
        // 设置默认值
        this.config = {
            apiKey: config.apiKey,
            apiSecret: config.apiSecret || '',
            baseUrl: config.baseUrl || 'https://api.yunmaovideo.com/v1'
        };
        // 初始化安全验证器
        this.validator = new security_validator_1.SecurityValidator({
            allowedDomains: ['yunmaovideo.com'],
            maxPayloadSize: 10 * 1024 * 1024, // 10MB
            enableUrlValidation: true,
            enableSqlInjectionCheck: false
        });
        // 创建增强的API客户端
        this.client = new enhanced_api_client_1.EnhancedApiClient('YunmaoClient', {
            timeout: 30000,
            maxRetries: 3,
            retryDelay: 1000,
            circuitBreakerThreshold: 0.5,
            circuitBreakerTimeout: 60000
        });
    }
    /**
     * 创建视频转文字任务
     */
    async createExtractTextTask(params) {
        logger_1.logger.info('YunmaoClient', 'createExtractTextTask', '创建视频转文字任务', {
            videoUrl: params.videoUrl.substring(0, 50) + '...',
            language: params.language
        });
        try {
            // 验证输入参数
            this.validator.validateUrl(params.videoUrl);
            if (params.webhookUrl) {
                this.validator.validateUrl(params.webhookUrl);
            }
            // 构建请求
            const requestData = {
                video_url: params.videoUrl,
                language: params.language || 'zh-CN',
                dialogue_mode: params.dialogueMode || false,
                speaker_count: params.speakerCount,
                output_format: params.outputFormat || 'text',
                webhook_url: params.webhookUrl
            };
            // 调用API
            const response = await this.client.post(`${this.config.baseUrl}/extract-text`, requestData, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'X-API-Secret': this.config.apiSecret,
                    'Content-Type': 'application/json'
                }
            });
            // 解析响应
            return this.parseExtractTextResponse(response.data);
        }
        catch (error) {
            logger_1.logger.error('YunmaoClient', 'createExtractTextTask', '创建任务失败', error);
            throw this.handleError(error);
        }
    }
    /**
     * 查询任务状态
     */
    async getTaskStatus(taskId) {
        logger_1.logger.info('YunmaoClient', 'getTaskStatus', '查询任务状态', { taskId });
        try {
            // 验证任务ID
            if (!taskId || typeof taskId !== 'string') {
                throw new Error('无效的任务ID');
            }
            // 调用API
            const response = await this.client.get(`${this.config.baseUrl}/tasks/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'X-API-Secret': this.config.apiSecret
                }
            });
            // 解析响应
            return this.parseTaskStatusResponse(response.data);
        }
        catch (error) {
            logger_1.logger.error('YunmaoClient', 'getTaskStatus', '查询状态失败', error);
            throw this.handleError(error);
        }
    }
    /**
     * 等待任务完成
     */
    async waitForCompletion(taskId, options = {}) {
        var _a;
        const maxWaitTime = options.maxWaitTime || 600000; // 默认10分钟
        const pollInterval = options.pollInterval || 5000; // 默认5秒
        const startTime = Date.now();
        logger_1.logger.info('YunmaoClient', 'waitForCompletion', '开始等待任务完成', { taskId });
        while (true) {
            // 检查是否超时
            if (Date.now() - startTime > maxWaitTime) {
                throw new Error('任务处理超时');
            }
            // 查询状态
            const status = await this.getTaskStatus(taskId);
            // 报告进度
            if (options.onProgress && status.progress) {
                options.onProgress(status.progress);
            }
            // 检查是否完成
            if (status.status === 'completed') {
                logger_1.logger.info('YunmaoClient', 'waitForCompletion', '任务完成', { taskId });
                return status;
            }
            if (status.status === 'failed') {
                throw new Error(`任务失败: ${((_a = status.error) === null || _a === void 0 ? void 0 : _a.message) || '未知错误'}`);
            }
            // 等待下次轮询
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }
    /**
     * 一站式视频转文字（创建任务并等待完成）
     */
    async extractText(videoUrl, options = {}) {
        // 创建任务
        const task = await this.createExtractTextTask({
            videoUrl,
            language: options.language,
            dialogueMode: options.dialogueMode,
            speakerCount: options.speakerCount,
            outputFormat: options.outputFormat,
            webhookUrl: options.webhookUrl
        });
        // 如果不等待结果，直接返回
        if (!options.waitForResult) {
            return task;
        }
        // 等待任务完成
        return await this.waitForCompletion(task.taskId, {
            maxWaitTime: options.maxWaitTime,
            onProgress: options.onProgress
        });
    }
    /**
     * 解析视频转文字响应
     */
    parseExtractTextResponse(data) {
        return {
            taskId: data.task_id || data.id,
            status: data.status || 'processing',
            progress: data.progress,
            result: data.result ? {
                text: data.result.text,
                fileUrl: data.result.file_url,
                duration: data.result.duration,
                wordCount: data.result.word_count
            } : undefined,
            error: data.error ? {
                code: data.error.code,
                message: data.error.message
            } : undefined
        };
    }
    /**
     * 解析任务状态响应
     */
    parseTaskStatusResponse(data) {
        const base = this.parseExtractTextResponse(data);
        return Object.assign(Object.assign({}, base), { createdAt: data.created_at, updatedAt: data.updated_at, estimatedTime: data.estimated_time });
    }
    /**
     * 错误处理
     */
    handleError(error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            switch (status) {
                case 401:
                    return new Error('API密钥无效或已过期');
                case 403:
                    return new Error('权限不足或配额已用完');
                case 404:
                    return new Error('任务不存在');
                case 429:
                    return new Error('请求过于频繁，请稍后重试');
                case 500:
                    return new Error(`服务器错误: ${(data === null || data === void 0 ? void 0 : data.message) || '请稍后重试'}`);
                default:
                    return new Error(`API错误 (${status}): ${(data === null || data === void 0 ? void 0 : data.message) || error.message}`);
            }
        }
        return error instanceof Error ? error : new Error('未知错误');
    }
    /**
     * 获取支持的语言列表
     */
    static getSupportedLanguages() {
        return [
            { code: 'zh-CN', name: '中文（普通话）' },
            { code: 'zh-TW', name: '中文（繁体）' },
            { code: 'zh-yue', name: '中文（粤语）' },
            { code: 'zh-sichuan', name: '中文（四川话）' },
            { code: 'zh-northeast', name: '中文（东北话）' },
            { code: 'en-US', name: '英语（美式）' },
            { code: 'en-GB', name: '英语（英式）' },
            { code: 'ja-JP', name: '日语' },
            { code: 'ko-KR', name: '韩语' },
            { code: 'es-ES', name: '西班牙语' },
            { code: 'fr-FR', name: '法语' },
            { code: 'de-DE', name: '德语' },
            { code: 'ru-RU', name: '俄语' },
            { code: 'ar-SA', name: '阿拉伯语' },
            { code: 'pt-BR', name: '葡萄牙语' }
        ];
    }
    /**
     * 清理资源
     */
    dispose() {
        this.client.dispose();
    }
}
exports.YunmaoClient = YunmaoClient;
