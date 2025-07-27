"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TikHubClient = void 0;
const enhanced_api_client_1 = require("../utils/enhanced-api-client");
const logger_1 = require("../utils/logger");
const security_validator_1 = require("../utils/security-validator");
const error_types_1 = require("../utils/error-types");
/**
 * TikHub 客户端
 * 专注于抖音视频地址解析
 */
class TikHubClient {
    constructor(config) {
        var _a;
        this.config = {
            apiToken: config.apiToken,
            baseUrl: config.baseUrl || 'https://api.tikhub.io',
            preferGuestMode: (_a = config.preferGuestMode) !== null && _a !== void 0 ? _a : true // 默认游客模式
        };
        this.validator = new security_validator_1.SecurityValidator({
            allowedDomains: ['douyin.com', 'iesdouyin.com', 'douyinvod.com'],
            enableUrlValidation: true
        });
        this.client = new enhanced_api_client_1.EnhancedApiClient('TikHubClient', {
            timeout: 15000,
            maxRetries: 3,
            retryDelay: 1000
        });
    }
    /**
     * 解析抖音视频地址（主要方法）
     */
    async resolveVideo(request) {
        logger_1.logger.info('TikHubClient', 'resolveVideo', '开始解析视频', {
            url: request.url.substring(0, 50) + '...'
        });
        try {
            // 1. 验证输入URL
            this.validator.validateUrl(request.url);
            // 2. 提取视频ID
            const videoId = this.extractVideoId(request.url);
            if (!videoId) {
                throw new error_types_1.ValidationError('无法从URL中提取视频ID', 'url', request.url);
            }
            // 3. 根据配置选择API
            const useGuestMode = request.needAuth === false || this.config.preferGuestMode;
            if (useGuestMode) {
                return await this.resolveViaWebApi(videoId, request);
            }
            else {
                return await this.resolveViaAppApi(videoId, request);
            }
        }
        catch (error) {
            logger_1.logger.error('TikHubClient', 'resolveVideo', '解析失败', error);
            throw this.handleError(error);
        }
    }
    /**
     * 通过 Web API 解析（游客模式）
     */
    async resolveViaWebApi(videoId, request) {
        logger_1.logger.info('TikHubClient', 'resolveViaWebApi', '使用Web API解析');
        const response = await this.client.get(`${this.config.baseUrl}/api/v1/douyin/web/fetch_one_video`, {
            params: {
                aweme_id: videoId
            },
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json'
            }
        });
        return this.parseWebApiResponse(response.data, videoId);
    }
    /**
     * 通过 App API 解析（可能需要更多权限）
     */
    async resolveViaAppApi(videoId, request) {
        logger_1.logger.info('TikHubClient', 'resolveViaAppApi', '使用App API解析');
        const response = await this.client.post(`${this.config.baseUrl}/api/v1/douyin/app/v3/fetch_one_video`, {
            aweme_id: videoId,
            version_code: '34.1.0',
            device_platform: 'android'
        }, {
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json'
            }
        });
        return this.parseAppApiResponse(response.data, videoId);
    }
    /**
     * 提取视频ID
     */
    extractVideoId(url) {
        // 处理短链接
        const shortLinkMatch = url.match(/v\.douyin\.com\/([a-zA-Z0-9]+)/);
        if (shortLinkMatch) {
            return shortLinkMatch[1];
        }
        // 处理长链接
        const longLinkMatch = url.match(/video\/(\d+)/);
        if (longLinkMatch) {
            return longLinkMatch[1];
        }
        // 处理其他格式
        const patterns = [
            /aweme_id=(\d+)/,
            /\/([\d]{19})/,
            /modal_id=(\d+)/
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }
    /**
     * 解析 Web API 响应
     */
    parseWebApiResponse(data, videoId) {
        var _a, _b, _c, _d, _e;
        const video = data.aweme_detail || data.item || data;
        // 提取视频URLs
        const urlList = ((_b = (_a = video.video) === null || _a === void 0 ? void 0 : _a.play_addr) === null || _b === void 0 ? void 0 : _b.url_list) || [];
        const urls = this.selectBestUrls(urlList);
        if (urls.length === 0) {
            throw new error_types_1.ServiceError('TikHub', '未找到可用的视频地址', 404, false);
        }
        return {
            videoId,
            videoUrl: urls[0],
            videoUrls: urls,
            metadata: {
                title: video.desc || ((_c = video.share_info) === null || _c === void 0 ? void 0 : _c.share_title),
                author: (_d = video.author) === null || _d === void 0 ? void 0 : _d.nickname,
                duration: (_e = video.video) === null || _e === void 0 ? void 0 : _e.duration,
                createTime: video.create_time ? new Date(video.create_time * 1000).toISOString() : undefined
            }
        };
    }
    /**
     * 解析 App API 响应
     */
    parseAppApiResponse(data, videoId) {
        var _a, _b, _c;
        const video = ((_a = data.aweme_list) === null || _a === void 0 ? void 0 : _a[0]) || data.aweme_detail || data;
        // App API 可能返回更多格式选项
        const playAddr = ((_b = video.video) === null || _b === void 0 ? void 0 : _b.play_addr) || {};
        const urlList = playAddr.url_list || [];
        const urls = this.selectBestUrls(urlList);
        if (urls.length === 0) {
            throw new error_types_1.ServiceError('TikHub', '未找到可用的视频地址', 404, false);
        }
        return {
            videoId,
            videoUrl: urls[0],
            videoUrls: urls,
            metadata: {
                title: video.desc,
                author: (_c = video.author) === null || _c === void 0 ? void 0 : _c.nickname,
                duration: video.duration,
                createTime: video.create_time ? new Date(video.create_time * 1000).toISOString() : undefined
            }
        };
    }
    /**
     * 选择最佳的视频URLs
     */
    selectBestUrls(urlList) {
        if (!Array.isArray(urlList) || urlList.length === 0) {
            return [];
        }
        // 过滤和排序URLs
        const validUrls = urlList
            .filter(url => {
            // 过滤无效URL
            if (!url || typeof url !== 'string')
                return false;
            if (!url.startsWith('http'))
                return false;
            // 验证域名
            try {
                const urlObj = new URL(url);
                const allowedDomains = ['douyinvod.com', 'douyincdn.com', 'snssdk.com'];
                return allowedDomains.some(domain => urlObj.hostname.includes(domain));
            }
            catch (_a) {
                return false;
            }
        })
            .sort((a, b) => {
            // 优先选择特定CDN
            const preferredCDN = ['v26', 'v3', 'v9'];
            const aScore = preferredCDN.findIndex(cdn => a.includes(cdn));
            const bScore = preferredCDN.findIndex(cdn => b.includes(cdn));
            if (aScore !== -1 && bScore !== -1) {
                return aScore - bScore;
            }
            if (aScore !== -1)
                return -1;
            if (bScore !== -1)
                return 1;
            return 0;
        });
        // 去重
        return [...new Set(validUrls)];
    }
    /**
     * 批量解析视频
     */
    async resolveVideoBatch(urls) {
        logger_1.logger.info('TikHubClient', 'resolveVideoBatch', `批量解析 ${urls.length} 个视频`);
        const results = await Promise.allSettled(urls.map(url => this.resolveVideo({ url })));
        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            else {
                logger_1.logger.warn('TikHubClient', 'resolveVideoBatch', `视频 ${index} 解析失败`, {
                    url: urls[index],
                    error: result.reason
                });
                throw result.reason;
            }
        });
    }
    /**
     * 错误处理
     */
    handleError(error) {
        var _a, _b;
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;
            switch (status) {
                case 401:
                    return new error_types_1.ApiKeyInvalidError('TikHub');
                case 403:
                    return new error_types_1.ServiceError('TikHub', 'API 配额不足或权限受限', 403, false);
                case 404:
                    return new error_types_1.VideoNotFoundError(this.extractVideoId(((_b = (_a = error.config) === null || _a === void 0 ? void 0 : _a.params) === null || _b === void 0 ? void 0 : _b.aweme_id) || '') || 'unknown', 'douyin');
                case 429:
                    const retryAfter = error.response.headers['retry-after'];
                    return new error_types_1.RateLimitError('TikHub', retryAfter ? parseInt(retryAfter) : undefined);
                default:
                    return new error_types_1.ServiceError('TikHub', `API错误: ${(data === null || data === void 0 ? void 0 : data.message) || error.message}`, status, status >= 500);
            }
        }
        // 网络错误
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return new error_types_1.NetworkError('无法连接到TikHub服务', { code: error.code }, error);
        }
        return error instanceof Error ? error : new error_types_1.ServiceError('TikHub', '解析视频失败', undefined, true);
    }
    /**
     * 测试连接
     */
    async testConnection() {
        try {
            const response = await this.client.get(`${this.config.baseUrl}/`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiToken}`
                }
            });
            return response.status === 200;
        }
        catch (_a) {
            return false;
        }
    }
    /**
     * 清理资源
     */
    dispose() {
        this.client.dispose();
    }
}
exports.TikHubClient = TikHubClient;
