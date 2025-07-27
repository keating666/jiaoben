"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = transcribeV3;
exports.getServiceStatus = getServiceStatus;
const monitoring_1 = require("../../tech-validation/utils/monitoring");
const error_types_1 = require("../../tech-validation/utils/error-types");
const fallback_strategy_1 = require("../../tech-validation/services/fallback-strategy");
const robust_douyin_extractor_1 = require("../../tech-validation/utils/robust-douyin-extractor");
const prompt_template_manager_1 = require("../../tech-validation/services/prompt-template-manager");
const security_validator_1 = require("../../tech-validation/utils/security-validator");
const concurrency_controller_1 = require("../../tech-validation/utils/concurrency-controller");
// 创建全局实例
const fallbackManager = new fallback_strategy_1.FallbackStrategyManager({
    maxFailures: parseInt(process.env.FALLBACK_MAX_FAILURES || '3'),
    resetTimeout: parseInt(process.env.FALLBACK_RESET_TIMEOUT || '60000'),
    errorRateThreshold: parseFloat(process.env.FALLBACK_ERROR_THRESHOLD || '0.5')
});
const promptManager = new prompt_template_manager_1.PromptTemplateManager();
const concurrencyController = new concurrency_controller_1.ConcurrencyController(3);
const securityValidator = new security_validator_1.SecurityValidator();
// 输入验证
async function validateInput(req) {
    const monitor = monitoring_1.monitoring.startSpan('input_validation');
    try {
        const body = req.body;
        if (!body.mixedText && !body.videoUrl) {
            throw new error_types_1.ValidationError('必须提供 mixedText 或 videoUrl', 'input');
        }
        // 验证 style
        if (body.style && !['default', 'humorous', 'professional'].includes(body.style)) {
            throw new error_types_1.ValidationError('无效的 style 参数', 'style', body.style);
        }
        monitoring_1.monitoring.endSpan(monitor, 'success');
        return body;
    }
    catch (error) {
        monitoring_1.monitoring.endSpan(monitor, 'error', error);
        throw error;
    }
}
// 提取视频 URL
async function extractVideoUrl(input) {
    const monitor = monitoring_1.monitoring.startSpan('extract_video_url');
    try {
        if (input.videoUrl) {
            monitoring_1.monitoring.endSpan(monitor, 'success');
            return input.videoUrl;
        }
        if (input.mixedText) {
            const extractResult = await robust_douyin_extractor_1.RobustDouyinExtractor.extract(input.mixedText);
            if (extractResult.links.length === 0) {
                throw new error_types_1.ValidationError('未找到有效的视频链接', 'mixedText');
            }
            monitoring_1.monitoring.endSpan(monitor, 'success');
            return extractResult.links[0].url;
        }
        throw new error_types_1.ValidationError('无法提取视频链接', 'input');
    }
    catch (error) {
        monitoring_1.monitoring.endSpan(monitor, 'error', error);
        throw error;
    }
}
// 生成脚本（使用模板）
async function generateScriptWithTemplate(transcript, request) {
    const monitor = monitoring_1.monitoring.startSpan('generate_script');
    try {
        // 选择模板
        const templateId = request.templateId || `${request.style || 'default'}-script`;
        // 渲染模板
        const prompt = promptManager.renderTemplate(templateId, {
            transcriptText: transcript,
            style: request.style || 'default',
            language: request.language || 'zh'
        });
        // 使用降级策略生成脚本
        const result = await fallbackManager.generateScriptWithFallback(transcript, prompt);
        monitoring_1.monitoring.endSpan(monitor, 'success');
        return result;
    }
    catch (error) {
        monitoring_1.monitoring.endSpan(monitor, 'error', error);
        throw error;
    }
}
// 主处理函数
async function transcribeV3(req, res) {
    var _a;
    const monitor = monitoring_1.monitoring.startSpan('video.transcribe-v3', {
        method: req.method,
        url: req.url
    });
    const startTime = Date.now();
    try {
        // 1. 方法验证
        if (req.method !== 'POST') {
            monitoring_1.monitoring.recordMetric('api.error.count', 1, { error_type: 'method_not_allowed' });
            res.status(405).json({
                success: false,
                error: {
                    code: 'METHOD_NOT_ALLOWED',
                    message: '仅支持 POST 请求',
                    userMessage: '请求方法不正确',
                    retryable: false
                }
            });
            return;
        }
        // 2. API 密钥验证
        const authValidation = security_validator_1.SecurityValidator.validateAuthorizationHeader(req.headers.authorization);
        if (!authValidation.valid) {
            monitoring_1.monitoring.recordMetric('api.error.count', 1, { error_type: 'unauthorized' });
            res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: authValidation.reason || '未提供有效的API密钥',
                    userMessage: '认证失败，请检查API密钥',
                    retryable: false
                }
            });
            return;
        }
        // 3. 并发控制
        const processingResult = await concurrencyController.execute(async () => {
            // 3.1 输入验证
            const input = await validateInput(req);
            monitoring_1.monitoring.recordMetric('api.request.count', 1, { style: input.style || 'default' });
            // 3.2 链接提取
            const videoUrl = await extractVideoUrl(input);
            monitoring_1.monitoring.recordMetric('video.url_extracted', 1);
            // 3.3 视频解析（带降级）
            const realUrlResult = await fallbackManager.resolveVideoWithFallback(videoUrl);
            monitoring_1.monitoring.recordMetric('video.resolved', 1, { source: realUrlResult.source });
            // 3.4 音频转文字（带降级）
            const transcriptResult = await fallbackManager.transcribeWithFallback({
                videoUrl: realUrlResult.url
            });
            monitoring_1.monitoring.recordMetric('video.transcribed', 1, {
                provider: transcriptResult.provider,
                confidence: Math.round(transcriptResult.confidence * 100)
            });
            // 3.5 脚本生成（带模板）
            const scriptResult = await generateScriptWithTemplate(transcriptResult.text, input);
            monitoring_1.monitoring.recordMetric('script.generated', 1, { provider: scriptResult.provider });
            const processingTime = Date.now() - startTime;
            return {
                success: true,
                data: {
                    originalText: transcriptResult.text,
                    script: scriptResult.script,
                    processingTime,
                    provider: {
                        videoResolver: realUrlResult.source,
                        transcription: transcriptResult.provider,
                        scriptGenerator: scriptResult.provider
                    }
                }
            };
        });
        // 成功响应
        monitoring_1.monitoring.endSpan(monitor, 'success');
        monitoring_1.monitoring.recordMetric('api.success.count', 1);
        monitoring_1.monitoring.recordMetric('api.processing_time', ((_a = processingResult.data) === null || _a === void 0 ? void 0 : _a.processingTime) || 0);
        res.status(200).json(processingResult);
    }
    catch (error) {
        // 错误处理
        monitoring_1.monitoring.endSpan(monitor, 'error', error);
        monitoring_1.monitoring.recordError(error, {
            endpoint: 'transcribe-v3',
            processingTime: Date.now() - startTime
        });
        const userMessage = error_types_1.ErrorHandler.getUserMessage(error);
        const isRetryable = error_types_1.ErrorHandler.isRetryable(error);
        // 确定状态码
        let statusCode = 500;
        if (error instanceof error_types_1.ValidationError)
            statusCode = 400;
        else if (error instanceof error_types_1.ServiceError)
            statusCode = error.statusCode || 503;
        res.status(statusCode).json({
            success: false,
            error: {
                code: error.code || 'PROCESSING_FAILED',
                message: error instanceof Error ? error.message : '处理失败',
                userMessage,
                retryable: isRetryable
            }
        });
    }
}
// 导出服务状态报告端点
async function getServiceStatus(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const report = fallbackManager.getServiceReport();
    const health = monitoring_1.monitoring.getHealthMetrics();
    res.status(200).json({
        services: report,
        health,
        timestamp: new Date().toISOString()
    });
}
