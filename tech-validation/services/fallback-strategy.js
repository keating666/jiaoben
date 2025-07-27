"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackStrategyManager = void 0;
const logger_1 = require("../utils/logger");
const error_types_1 = require("../utils/error-types");
class FallbackStrategyManager {
    constructor(config) {
        this.serviceStatus = new Map();
        this.config = Object.assign({ maxFailures: 3, resetTimeout: 60000, errorRateThreshold: 0.5, checkInterval: 30000 }, config);
    }
    /**
     * 视频解析服务降级策略
     */
    async resolveVideoWithFallback(videoUrl) {
        const strategies = [
            {
                name: 'TikHub-Web',
                execute: () => this.tikHubWebResolve(videoUrl),
                priority: 1
            },
            {
                name: 'TikHub-App',
                execute: () => this.tikHubAppResolve(videoUrl),
                priority: 2
            },
            {
                name: 'LocalParser',
                execute: () => this.localVideoParser(videoUrl),
                priority: 3
            },
            {
                name: 'DirectUrl',
                execute: () => this.directUrlFallback(videoUrl),
                priority: 4
            }
        ];
        // 按优先级尝试
        for (const strategy of strategies.sort((a, b) => a.priority - b.priority)) {
            if (!this.isServiceAvailable(strategy.name)) {
                logger_1.logger.warn('FallbackStrategy', 'resolveVideo', `跳过不可用服务: ${strategy.name}`);
                continue;
            }
            try {
                const result = await strategy.execute();
                this.recordSuccess(strategy.name);
                logger_1.logger.info('FallbackStrategy', 'resolveVideo', `成功使用: ${strategy.name}`);
                return Object.assign(Object.assign({}, result), { source: strategy.name });
            }
            catch (error) {
                this.recordFailure(strategy.name, error);
                logger_1.logger.warn('FallbackStrategy', 'resolveVideo', `${strategy.name} 失败`, {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        throw new error_types_1.ServiceUnavailableError('VideoResolver', '所有视频解析策略都失败了');
    }
    /**
     * 音频转文字服务降级策略
     */
    async transcribeWithFallback(input) {
        const strategies = [
            {
                name: 'Yunmao',
                execute: () => this.yunmaoTranscribe(input.videoUrl),
                condition: () => !!input.videoUrl,
                priority: 1
            },
            {
                name: 'MiniMax',
                execute: () => this.minimaxTranscribe(input.audioPath || input.videoUrl),
                priority: 2
            },
            {
                name: 'Aliyun',
                execute: () => this.aliyunTranscribe(input.audioPath || input.videoUrl),
                priority: 3
            },
            {
                name: 'MockTranscription',
                execute: () => this.mockTranscription(),
                priority: 999 // 最后的保底方案
            }
        ];
        for (const strategy of strategies.sort((a, b) => a.priority - b.priority)) {
            // 检查条件
            if (strategy.condition && !strategy.condition()) {
                continue;
            }
            if (!this.isServiceAvailable(strategy.name)) {
                continue;
            }
            try {
                const result = await strategy.execute();
                this.recordSuccess(strategy.name);
                return Object.assign(Object.assign({}, result), { provider: strategy.name });
            }
            catch (error) {
                this.recordFailure(strategy.name, error);
            }
        }
        throw new error_types_1.ServiceUnavailableError('Transcription', '所有转录服务都不可用');
    }
    /**
     * AI 脚本生成服务降级策略
     */
    async generateScriptWithFallback(text, template) {
        const strategies = [
            {
                name: 'TongYi',
                execute: () => this.tongyiGenerate(text, template),
                priority: 1
            },
            {
                name: 'MiniMax',
                execute: () => this.minimaxGenerate(text, template),
                priority: 2
            },
            {
                name: 'SimpleParser',
                execute: () => this.simpleScriptParser(text),
                priority: 3
            }
        ];
        for (const strategy of strategies.sort((a, b) => a.priority - b.priority)) {
            if (!this.isServiceAvailable(strategy.name)) {
                continue;
            }
            try {
                const result = await strategy.execute();
                this.recordSuccess(strategy.name);
                return { script: result, provider: strategy.name };
            }
            catch (error) {
                this.recordFailure(strategy.name, error);
            }
        }
        // 最终降级：返回基础脚本
        return {
            script: this.generateBasicScript(text),
            provider: 'BasicGenerator'
        };
    }
    // ========== 具体实现方法 ==========
    async tikHubWebResolve(videoUrl) {
        // TikHub Web API 实现
        const tikHubClient = new (await Promise.resolve().then(() => __importStar(require('../clients/tikhub-client')))).TikHubClient({
            apiToken: process.env.TIKHUB_API_TOKEN || '',
            preferGuestMode: true
        });
        try {
            const result = await tikHubClient.resolveVideo({ url: videoUrl });
            tikHubClient.dispose();
            return { url: result.videoUrl };
        }
        catch (error) {
            tikHubClient.dispose();
            throw error;
        }
    }
    async tikHubAppResolve(videoUrl) {
        // TikHub App API 实现
        const tikHubClient = new (await Promise.resolve().then(() => __importStar(require('../clients/tikhub-client')))).TikHubClient({
            apiToken: process.env.TIKHUB_API_TOKEN || '',
            preferGuestMode: false
        });
        try {
            const result = await tikHubClient.resolveVideo({
                url: videoUrl,
                needAuth: true
            });
            tikHubClient.dispose();
            return { url: result.videoUrl };
        }
        catch (error) {
            tikHubClient.dispose();
            throw error;
        }
    }
    async localVideoParser(videoUrl) {
        // 本地解析器（基于已知模式）
        logger_1.logger.info('FallbackStrategy', 'localVideoParser', '使用本地解析器');
        // 简单的URL转换逻辑
        if (videoUrl.includes('v.douyin.com')) {
            // 尝试直接构造可能的视频URL
            return {
                url: videoUrl.replace('v.douyin.com', 'v26-web.douyinvod.com')
            };
        }
        throw new Error('本地解析器无法处理此URL');
    }
    async directUrlFallback(videoUrl) {
        // 直接返回原URL（最后的尝试）
        logger_1.logger.warn('FallbackStrategy', 'directUrlFallback', '使用原始URL作为最后尝试');
        return { url: videoUrl };
    }
    async yunmaoTranscribe(videoUrl) {
        // 云猫转码实现
        const yunmaoClient = new (await Promise.resolve().then(() => __importStar(require('../clients/yunmao-client')))).YunmaoClient({
            apiKey: process.env.YUNMAO_API_KEY || '',
            apiSecret: process.env.YUNMAO_API_SECRET || ''
        });
        try {
            const result = await yunmaoClient.extractText(videoUrl, {
                language: 'zh',
                output: 'txt',
                subtitle_type: 'srt',
                is_dialogue: false
            });
            yunmaoClient.dispose();
            return {
                text: result.textContent,
                confidence: 0.95 // 云猫通常准确度很高
            };
        }
        catch (error) {
            yunmaoClient.dispose();
            throw error;
        }
    }
    async minimaxTranscribe(input) {
        // MiniMax 实现
        const minimaxClient = new (await Promise.resolve().then(() => __importStar(require('../clients/minimax-client-v2')))).MiniMaxClientV2({
            apiBase: process.env.MINIMAX_API_BASE_URL || '',
            groupId: process.env.MINIMAX_GROUP_ID || ''
        });
        try {
            // 如果是视频URL，需要先下载音频
            const audioFilePath = input.includes('http') ? await this.downloadAudio(input) : input;
            const result = await minimaxClient.transcribeAudio(audioFilePath);
            // 清理下载的临时文件
            if (input.includes('http')) {
                const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                await fs.unlink(audioFilePath).catch(() => { });
            }
            minimaxClient.dispose();
            return {
                text: result.text,
                confidence: 0.9 // MiniMax准确度也很好
            };
        }
        catch (error) {
            minimaxClient.dispose();
            throw error;
        }
    }
    async aliyunTranscribe(input) {
        // 阿里云实现 - 暂时返回未实现
        throw new error_types_1.ServiceError('Aliyun', '阿里云语音识别服务暂未集成', 501, false);
    }
    async mockTranscription() {
        // 模拟转录（开发/测试用）
        logger_1.logger.warn('FallbackStrategy', 'mockTranscription', '使用模拟转录数据');
        return {
            text: '这是一个测试视频的转录文本。视频内容包含了各种有趣的元素...',
            confidence: 0.1
        };
    }
    async tongyiGenerate(text, template) {
        // 通义千问实现
        const tongyiClient = new (await Promise.resolve().then(() => __importStar(require('../clients/tongyi-client')))).TongyiClient({
            apiKey: process.env.TONGYI_API_KEY || '',
            baseUrl: process.env.TONGYI_API_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
            model: process.env.TONGYI_MODEL || 'qwen-plus'
        });
        try {
            const prompt = template.replace('{{transcriptText}}', text);
            const result = await tongyiClient.generateScript(prompt);
            tongyiClient.dispose();
            return result.data;
        }
        catch (error) {
            tongyiClient.dispose();
            throw error;
        }
    }
    async minimaxGenerate(text, template) {
        // MiniMax 生成实现 - 暂未实现文本生成功能
        throw new error_types_1.ServiceError('MiniMax', 'MiniMax文本生成服务暂未集成', 501, false);
    }
    async simpleScriptParser(text) {
        // 简单的脚本解析器
        logger_1.logger.info('FallbackStrategy', 'simpleScriptParser', '使用简单脚本解析器');
        // 基于规则的简单分段
        const sentences = text.split(/[。！？]/);
        const scenes = [];
        for (let i = 0; i < sentences.length; i += 3) {
            scenes.push({
                scene_number: Math.floor(i / 3) + 1,
                timestamp: `00:${String(i * 10).padStart(2, '0')}-00:${String((i + 3) * 10).padStart(2, '0')}`,
                description: '场景描述',
                dialogue: sentences.slice(i, i + 3).join('。'),
                notes: '自动生成'
            });
        }
        return {
            title: '自动生成的视频脚本',
            duration: scenes.length * 30,
            scenes
        };
    }
    generateBasicScript(text) {
        // 最基础的脚本生成
        return {
            title: '基础脚本',
            duration: 60,
            scenes: [{
                    scene_number: 1,
                    timestamp: '00:00-01:00',
                    description: '完整内容',
                    dialogue: text,
                    notes: '降级生成'
                }]
        };
    }
    // ========== 服务管理方法 ==========
    isServiceAvailable(serviceName) {
        const status = this.serviceStatus.get(serviceName);
        if (!status) {
            // 新服务默认可用
            this.serviceStatus.set(serviceName, {
                available: true,
                lastCheckTime: Date.now(),
                failureCount: 0,
                errorRate: 0
            });
            return true;
        }
        // 检查是否需要重置
        if (!status.available &&
            status.lastFailureTime &&
            Date.now() - status.lastFailureTime > this.config.resetTimeout) {
            logger_1.logger.info('FallbackStrategy', 'isServiceAvailable', `重置服务状态: ${serviceName}`);
            status.available = true;
            status.failureCount = 0;
            status.errorRate = 0;
        }
        return status.available;
    }
    recordSuccess(serviceName) {
        const status = this.serviceStatus.get(serviceName) || {
            available: true,
            lastCheckTime: Date.now(),
            failureCount: 0,
            errorRate: 0
        };
        // 更新错误率（简单移动平均）
        status.errorRate = status.errorRate * 0.9; // 成功会降低错误率
        status.lastCheckTime = Date.now();
        this.serviceStatus.set(serviceName, status);
    }
    recordFailure(serviceName, error) {
        const status = this.serviceStatus.get(serviceName) || {
            available: true,
            lastCheckTime: Date.now(),
            failureCount: 0,
            errorRate: 0
        };
        status.failureCount++;
        status.lastFailureTime = Date.now();
        status.errorRate = Math.min(status.errorRate * 0.9 + 0.1, 1); // 失败会增加错误率
        // 检查是否需要标记为不可用
        if (status.failureCount >= this.config.maxFailures ||
            status.errorRate > this.config.errorRateThreshold) {
            status.available = false;
            logger_1.logger.error('FallbackStrategy', 'recordFailure', `服务已标记为不可用: ${serviceName}`, {
                failureCount: status.failureCount,
                errorRate: status.errorRate
            });
        }
        this.serviceStatus.set(serviceName, status);
    }
    /**
     * 获取服务状态报告
     */
    getServiceReport() {
        const report = {};
        this.serviceStatus.forEach((status, name) => {
            report[name] = Object.assign({}, status);
        });
        return report;
    }
    /**
     * 手动重置服务状态
     */
    resetService(serviceName) {
        const status = this.serviceStatus.get(serviceName);
        if (status) {
            status.available = true;
            status.failureCount = 0;
            status.errorRate = 0;
            logger_1.logger.info('FallbackStrategy', 'resetService', `手动重置服务: ${serviceName}`);
        }
    }
    /**
     * 下载音频文件（为MiniMax等服务使用）
     */
    async downloadAudio(videoUrl) {
        const { VideoDownloader } = await Promise.resolve().then(() => __importStar(require('../utils/video-downloader')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const downloader = new VideoDownloader();
        const tempDir = path.join(process.cwd(), 'temp');
        // 确保临时目录存在
        await fs.mkdir(tempDir, { recursive: true });
        const audioPath = await downloader.downloadAudio(videoUrl, tempDir);
        return audioPath;
    }
}
exports.FallbackStrategyManager = FallbackStrategyManager;
