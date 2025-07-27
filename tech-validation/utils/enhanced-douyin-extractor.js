"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedDouyinExtractor = void 0;
const logger_1 = require("./logger");
const douyin_link_extractor_1 = require("./douyin-link-extractor");
/**
 * 增强版抖音链接提取器
 * 支持更多格式：口令、复制文本、特殊格式等
 */
class EnhancedDouyinExtractor extends douyin_link_extractor_1.DouyinLinkExtractor {
    /**
     * 智能提取抖音内容
     */
    static async smartExtract(text) {
        logger_1.logger.info('EnhancedDouyinExtractor', 'smartExtract', '开始智能提取', {
            textLength: text.length
        });
        // 1. 提取标准链接
        const links = this.extractEnhancedLinks(text);
        // 2. 提取口令
        const commands = this.extractCommands(text);
        // 3. 分析置信度
        const confidence = this.calculateConfidence(links, commands, text);
        // 4. 生成建议
        const suggestions = this.generateSuggestions(links, commands, text);
        // 5. 确定提取方法
        const method = this.determineMethod(links, commands);
        return {
            links,
            commands,
            confidence,
            method,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
        };
    }
    /**
     * 使用增强模式提取链接
     */
    static extractEnhancedLinks(text) {
        const links = [];
        const processedUrls = new Set();
        for (const pattern of this.ENHANCED_URL_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const rawUrl = match[0];
                const cleanUrl = this.cleanAndNormalizeUrl(rawUrl, text, match.index);
                if (!processedUrls.has(cleanUrl)) {
                    processedUrls.add(cleanUrl);
                    // 判断链接类型
                    const linkType = this.detectLinkType(cleanUrl);
                    links.push({
                        url: cleanUrl,
                        platform: 'douyin',
                        originalText: text,
                        type: linkType,
                        position: match.index,
                    });
                }
            }
        }
        logger_1.logger.info('EnhancedDouyinExtractor', 'extractEnhancedLinks', '提取到链接', {
            count: links.length,
            links: links.map(l => l.url),
        });
        return links;
    }
    /**
     * 清理和规范化URL（增强版）
     */
    static cleanAndNormalizeUrl(url, fullText, position) {
        let cleaned = url.trim();
        // 1. 智能截断：检查URL后面的字符，避免误包含
        const afterUrl = fullText.substring(position + url.length, position + url.length + 10);
        // 如果后面紧跟中文或标点，需要智能截断
        const cutoffMatch = cleaned.match(/^(https?:\/\/[^\s\u4e00-\u9fa5，。！？、）)》】]+)/);
        if (cutoffMatch) {
            cleaned = cutoffMatch[1];
        }
        // 2. 移除尾部标点和特殊字符
        cleaned = cleaned.replace(/[!！。，、？?；;：:""''）)》】\s]+$/, '');
        // 3. 移除追踪参数但保留重要参数
        cleaned = this.cleanTrackingParams(cleaned);
        // 4. 确保协议
        if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
            cleaned = `https://${cleaned}`;
        }
        // 5. 规范化短链接
        if (cleaned.includes('v.douyin.com')) {
            const shortLinkMatch = cleaned.match(/v\.douyin\.com\/([\w\d]+)/);
            if (shortLinkMatch) {
                cleaned = `https://v.douyin.com/${shortLinkMatch[1]}`;
            }
        }
        return cleaned;
    }
    /**
     * 清理追踪参数但保留重要参数
     */
    static cleanTrackingParams(url) {
        try {
            const urlObj = new URL(url);
            const params = urlObj.searchParams;
            // 需要删除的追踪参数
            const trackingParams = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                'share_app_id', 'share_link_id', 'share_token',
                'tt_from', 'u_code', 'timestamp',
            ];
            trackingParams.forEach(param => params.delete(param));
            // 重要参数保留（如视频ID相关）
            urlObj.search = params.toString();
            return urlObj.toString().replace(/\?$/, ''); // 移除空的?
        }
        catch (_a) {
            // URL解析失败，返回简单清理版本
            return url.replace(/[&?]utm_[^&]*/g, '');
        }
    }
    /**
     * 检测链接类型
     */
    static detectLinkType(url) {
        if (url.includes('/video/'))
            return 'video';
        if (url.includes('/user/'))
            return 'user';
        if (url.includes('/hashtag/'))
            return 'hashtag';
        if (url.includes('live.douyin.com'))
            return 'live';
        if (url.includes('v.douyin.com'))
            return 'short';
        return 'unknown';
    }
    /**
     * 提取口令
     */
    static extractCommands(text) {
        const commands = [];
        const processedCommands = new Set();
        for (const pattern of this.COMMAND_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const fullText = match[0];
                const content = this.extractCommandContent(fullText);
                if (content && !processedCommands.has(content)) {
                    processedCommands.add(content);
                    commands.push({
                        type: this.detectCommandType(fullText),
                        content,
                        fullText,
                        position: match.index,
                    });
                }
            }
        }
        // 提取特殊格式
        for (const pattern of this.SPECIAL_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(text)) !== null) {
                if (match[0].includes('搜索')) {
                    commands.push({
                        type: 'search',
                        content: match[0].replace(/抖音搜索[：:]?\s*/, ''),
                        fullText: match[0],
                        position: match.index,
                    });
                }
            }
        }
        logger_1.logger.info('EnhancedDouyinExtractor', 'extractCommands', '提取到口令', {
            count: commands.length,
        });
        return commands;
    }
    /**
     * 提取口令内容
     */
    static extractCommandContent(fullText) {
        // 移除标记符号
        let content = fullText
            .replace(/[#＃%％￥¥$]/g, '')
            .replace(/复制此链接|打开抖音|复制这段话/g, '')
            .trim();
        // 提取核心内容
        const codeMatch = content.match(/[\w:/]+/);
        return codeMatch ? codeMatch[0] : content;
    }
    /**
     * 检测口令类型
     */
    static detectCommandType(text) {
        if (text.includes('复制'))
            return 'copy-text';
        return 'command';
    }
    /**
     * 计算提取置信度
     */
    static calculateConfidence(links, commands, text) {
        // 基础分数
        let score = 0;
        // 有链接：高置信度
        if (links.length > 0) {
            score += 0.9;
            // 短链接更可信
            if (links.some(l => l.type === 'short')) {
                score += 0.05;
            }
        }
        // 有口令：中等置信度
        if (commands.length > 0) {
            score += 0.7;
        }
        // 文本包含抖音相关词汇
        const douyinKeywords = ['抖音', '视频', '作品', '直播', '分享'];
        const hasKeywords = douyinKeywords.some(kw => text.includes(kw));
        if (hasKeywords) {
            score += 0.1;
        }
        // 归一化
        return Math.min(score, 1);
    }
    /**
     * 生成建议
     */
    static generateSuggestions(links, commands, text) {
        const suggestions = [];
        // 没有找到任何内容
        if (links.length === 0 && commands.length === 0) {
            if (text.includes('抖音') || text.includes('视频')) {
                suggestions.push('未找到有效的抖音链接，请确保复制完整的分享链接');
                suggestions.push('抖音分享链接通常以 https://v.douyin.com/ 开头');
            }
        }
        // 找到口令
        if (commands.length > 0 && links.length === 0) {
            suggestions.push('检测到抖音口令，请在抖音APP中打开');
            if (commands.some(c => c.type === 'search')) {
                suggestions.push('检测到搜索关键词，请在抖音APP中搜索');
            }
        }
        // 多个链接
        if (links.length > 1) {
            suggestions.push(`找到${links.length}个链接，将按顺序处理`);
        }
        return suggestions;
    }
    /**
     * 确定提取方法
     */
    static determineMethod(links, commands) {
        if (links.length > 0 && commands.length > 0)
            return 'mixed';
        if (links.length > 0)
            return 'regex';
        if (commands.length > 0)
            return 'command';
        return 'regex';
    }
    /**
     * 批量提取（覆盖父类方法）
     */
    static extractAllDouyinLinks(text) {
        return this.extractEnhancedLinks(text);
    }
}
exports.EnhancedDouyinExtractor = EnhancedDouyinExtractor;
// 增强的URL模式
EnhancedDouyinExtractor.ENHANCED_URL_PATTERNS = [
    // ===== 标准链接格式 =====
    // 短链接（最常见）
    /https?:\/\/v\.douyin\.com\/[\w\d]+\/?/gi,
    // 完整视频链接
    /https?:\/\/www\.douyin\.com\/video\/\d+\/?/gi,
    // 分享链接
    /https?:\/\/www\.iesdouyin\.com\/share\/video\/\d+\/?/gi,
    // ===== 特殊链接格式 =====
    // 用户主页链接
    /https?:\/\/www\.douyin\.com\/user\/[\w\-]+\/?/gi,
    // 话题链接
    /https?:\/\/www\.douyin\.com\/hashtag\/\d+\/?/gi,
    // 直播链接
    /https?:\/\/live\.douyin\.com\/\d+\/?/gi,
    /https?:\/\/webcast\.amemv\.com\/douyin\/webcast\/reflow\/\w+/gi,
    // ===== 移动端链接 =====
    // 抖音极速版
    /https?:\/\/v\.douyinvod\.com\/[\w\d]+\/?/gi,
    // 国际版 TikTok（可能混用）
    /https?:\/\/vm\.tiktok\.com\/[\w\d]+\/?/gi,
    // ===== 带参数的链接（保留重要参数） =====
    /https?:\/\/v\.douyin\.com\/[\w\d]+\/?\?[^\\s\u4e00-\u9fa5，。！？、）)》】]*/gi,
];
// 抖音口令模式（基于真实案例增强）
EnhancedDouyinExtractor.COMMAND_PATTERNS = [
    // 标准口令格式：#在抖音，记录美好生活#
    /[#＃]{1}[^#＃]+[#＃]{1}/g,
    // 数字+代码格式：7.53 MQc:/ 复制此链接
    /[\d.]+\s+[\w:/]+\s*复制此链接/g,
    // 更多数字代码格式变体
    /[\d.]+\s+[\w:/]+\s*复制打开抖音/g,
    /[\d.]+\s+[\w:/]+\s*打开Dou音/g,
    /[\d.]+\s+[\w:/]+\s*打开抖音/g,
    // 淘口令格式：￥AbCd1234￥
    /[￥¥$]{1}[\w\d]+[￥¥$]{1}/g,
    // 新版口令：%%开头
    /%%[\w\d\u4e00-\u9fa5]+%%/g,
    // dOU口令格式
    /dOU口令[:]?\s*[\w\d]+/g,
    // 带中文的口令
    /复制这段话[￥¥$#＃][^￥¥$#＃打开抖音]+打开抖音/g,
    // 长按复制格式
    /长按复制此段话[^打开抖音]+打开抖音/g,
    /长按复制此条消息[^打开抖音]+打开抖音/g,
    // 带特殊字符的分享格式（如 u0000ey, WZ, CZ, pqZ）
    /[uU]0{3,4}[\w]+/g,
    /[A-Z]{2}\s*[:：]\s*[\w\d]+/g,
    // 复制整段话格式
    /复制整段话[￥¥$#＃][^￥¥$#＃]+[￥¥$#＃]/g,
    // 分享码格式
    /分享码[:]?\s*[\w\d]+/g,
    /邀请码[:]?\s*[\w\d]+/g,
];
// 特殊文本模式
EnhancedDouyinExtractor.SPECIAL_PATTERNS = [
    // @用户名 的视频/作品
    /@[\w\u4e00-\u9fa5._-]+\s*的(视频|作品|直播|主页)/g,
    // 搜索指令
    /抖音搜索[：:]\s*[\u4e00-\u9fa5\w\s"'""''《》]+/g,
    // 话题标签
    /#[\u4e00-\u9fa5\w]+#?/g,
];
