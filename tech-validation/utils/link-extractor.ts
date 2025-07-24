import { logger } from './logger';

export interface ExtractedLink {
  url: string;
  platform: 'douyin' | 'tiktok' | 'youtube' | 'other';
  originalText: string;
}

export class LinkExtractor {
  // 抖音链接模式
  private static readonly DOUYIN_PATTERNS = [
    /https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+\/?/gi,  // 支持末尾有无斜杠
    /https?:\/\/www\.douyin\.com\/video\/\d+\/?/gi,
    /https?:\/\/www\.iesdouyin\.com\/share\/video\/\d+\/?/gi,
    // 更宽松的模式，支持各种特殊字符
    /https?:\/\/v\.douyin\.com\/[\w\d]+/gi,
  ];

  // YouTube 链接模式
  private static readonly YOUTUBE_PATTERNS = [
    /https?:\/\/(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/gi,
    /https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/gi,
    /https?:\/\/(www\.)?youtube\.com\/shorts\/[a-zA-Z0-9_-]+/gi,
  ];

  // TikTok 链接模式
  private static readonly TIKTOK_PATTERNS = [
    /https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/gi,
    /https?:\/\/vm\.tiktok\.com\/[a-zA-Z0-9]+/gi,
  ];

  /**
   * 从混合文本中提取视频链接
   */
  static extractVideoLink(text: string): ExtractedLink | null {
    logger.info('LinkExtractor', 'extractVideoLink', '开始提取视频链接', { textLength: text.length });

    // 尝试提取抖音链接
    for (const pattern of this.DOUYIN_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[0]) {
        logger.info('LinkExtractor', 'extractVideoLink', '找到抖音链接', { url: match[0] });
        return {
          url: match[0],
          platform: 'douyin',
          originalText: text,
        };
      }
    }

    // 尝试提取 YouTube 链接
    for (const pattern of this.YOUTUBE_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[0]) {
        logger.info('LinkExtractor', 'extractVideoLink', '找到 YouTube 链接', { url: match[0] });
        return {
          url: match[0],
          platform: 'youtube',
          originalText: text,
        };
      }
    }

    // 尝试提取 TikTok 链接
    for (const pattern of this.TIKTOK_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[0]) {
        logger.info('LinkExtractor', 'extractVideoLink', '找到 TikTok 链接', { url: match[0] });
        return {
          url: match[0],
          platform: 'tiktok',
          originalText: text,
        };
      }
    }

    // 尝试提取任何 URL
    const genericUrlPattern = /https?:\/\/[^\s]+/gi;
    const genericMatch = text.match(genericUrlPattern);
    if (genericMatch && genericMatch[0]) {
      logger.info('LinkExtractor', 'extractVideoLink', '找到通用链接', { url: genericMatch[0] });
      return {
        url: genericMatch[0],
        platform: 'other',
        originalText: text,
      };
    }

    logger.warn('LinkExtractor', 'extractVideoLink', '未找到有效的视频链接');
    return null;
  }

  /**
   * 清理和规范化链接
   */
  static cleanUrl(url: string): string {
    // 移除尾部的特殊字符
    let cleanedUrl = url.replace(/[!！。，、？?]+$/, '');
    
    // 移除可能的追踪参数
    cleanedUrl = cleanedUrl.replace(/[&?]utm_[^&]*/g, '');
    
    // 确保 URL 以正确的协议开头
    if (!cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
      cleanedUrl = 'https://' + cleanedUrl;
    }

    return cleanedUrl;
  }

  /**
   * 验证链接是否可访问（用于客户端）
   */
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 使用 AI 提取链接（备用方案）
   */
  static async extractWithAI(text: string, aiApiKey: string): Promise<ExtractedLink | null> {
    // 这里可以调用通义千问或其他 AI API 来智能提取链接
    // 当正则表达式无法识别时使用
    logger.info('LinkExtractor', 'extractWithAI', '使用 AI 提取链接（功能待实现）');
    
    // TODO: 实现 AI 提取逻辑
    // const prompt = `从以下文本中提取视频链接，只返回 URL：\n${text}`;
    // const response = await callAIAPI(prompt, aiApiKey);
    
    return null;
  }
}