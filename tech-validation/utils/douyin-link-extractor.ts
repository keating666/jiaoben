import axios from 'axios';

import { logger } from './logger';
import { ExtractedLink } from './link-extractor';

export interface DouyinVideoInfo {
  videoId: string;
  title?: string;
  author?: string;
  downloadUrl?: string;
  coverUrl?: string;
  duration?: number;
}

export class DouyinLinkExtractor {
  private static readonly DOUYIN_PATTERNS = [
    // 短链接格式
    /https?:\/\/v\.douyin\.com\/[\w\d]+\/?/gi,
    // 完整链接格式
    /https?:\/\/www\.douyin\.com\/video\/(\d+)\/?/gi,
    // 分享链接格式
    /https?:\/\/www\.iesdouyin\.com\/share\/video\/(\d+)\/?/gi,
    // 带参数的链接
    /https?:\/\/v\.douyin\.com\/[\w\d]+\/?\?[^\\s]*/gi,
  ];

  /**
   * 从文本中提取抖音链接
   */
  static extractDouyinLink(text: string): ExtractedLink | null {
    logger.info('DouyinLinkExtractor', 'extractDouyinLink', '开始提取抖音链接', { 
      textLength: text.length,
      textPreview: text.substring(0, 100), 
    });

    for (const pattern of this.DOUYIN_PATTERNS) {
      pattern.lastIndex = 0; // 重置正则表达式状态
      const match = text.match(pattern);

      if (match && match[0]) {
        const url = this.normalizeUrl(match[0]);

        logger.info('DouyinLinkExtractor', 'extractDouyinLink', '找到抖音链接', { url });

        return {
          url,
          platform: 'douyin',
          originalText: text,
        };
      }
    }

    logger.warn('DouyinLinkExtractor', 'extractDouyinLink', '未找到抖音链接');

    return null;
  }

  /**
   * 规范化抖音链接
   */
  static normalizeUrl(url: string): string {
    // 移除尾部的特殊字符和标点
    let normalizedUrl = url.trim()
      .replace(/[!！。，、？?；;：:""''）)]+$/, '')
      .replace(/\s+/g, '');

    // 移除追踪参数
    normalizedUrl = normalizedUrl.replace(/[&?]utm_[^&]*/g, '');
    
    // 确保有协议
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${  normalizedUrl}`;
    }

    // 处理特殊的抖音短链接情况
    if (normalizedUrl.includes('v.douyin.com')) {
      // 确保短链接格式正确
      const shortLinkMatch = normalizedUrl.match(/v\.douyin\.com\/([\w\d]+)/);

      if (shortLinkMatch) {
        normalizedUrl = `https://v.douyin.com/${shortLinkMatch[1]}`;
      }
    }

    return normalizedUrl;
  }

  /**
   * 解析短链接获取真实视频链接
   */
  static async resolveShortLink(shortUrl: string): Promise<string | null> {
    try {
      logger.info('DouyinLinkExtractor', 'resolveShortLink', '解析短链接', { shortUrl });
      
      // 发送请求获取重定向地址
      const response = await axios.get(shortUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status >= 300 && status < 400,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const location = response.headers.location;

      if (location) {
        logger.info('DouyinLinkExtractor', 'resolveShortLink', '获取到重定向地址', { location });

        return location;
      }
    } catch (error) {
      logger.error('DouyinLinkExtractor', 'resolveShortLink', '解析短链接失败', error as Error);
    }

    return null;
  }

  /**
   * 从URL中提取视频ID
   */
  static extractVideoId(url: string): string | null {
    // 从完整链接中提取视频ID
    const videoIdMatch = url.match(/\/video\/(\d+)/);

    if (videoIdMatch) {
      return videoIdMatch[1];
    }

    // 从短链接格式中提取ID
    const shortLinkMatch = url.match(/v\.douyin\.com\/([\w\d]+)/);

    if (shortLinkMatch) {
      return shortLinkMatch[1];
    }

    return null;
  }

  /**
   * 获取视频信息（需要进一步实现）
   */
  static async getVideoInfo(url: string): Promise<DouyinVideoInfo | null> {
    try {
      logger.info('DouyinLinkExtractor', 'getVideoInfo', '获取视频信息', { url });
      
      const videoId = this.extractVideoId(url);

      if (!videoId) {
        logger.error('DouyinLinkExtractor', 'getVideoInfo', '无法提取视频ID');

        return null;
      }

      // TODO: 实现实际的视频信息获取逻辑
      // 这里需要使用适当的API或解析方法
      logger.warn('DouyinLinkExtractor', 'getVideoInfo', '视频信息获取功能待实现');
      
      return {
        videoId,
        // 其他信息待实现
      };
    } catch (error) {
      logger.error('DouyinLinkExtractor', 'getVideoInfo', '获取视频信息失败', error as Error);

      return null;
    }
  }

  /**
   * 验证是否为有效的抖音链接
   */
  static isValidDouyinUrl(url: string): boolean {
    if (!url) {return false;}
    
    const normalizedUrl = this.normalizeUrl(url);
    
    // 检查是否匹配任何抖音URL模式
    return this.DOUYIN_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;

      return pattern.test(normalizedUrl);
    });
  }

  /**
   * 批量提取文本中的所有抖音链接
   */
  static extractAllDouyinLinks(text: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    const processedUrls = new Set<string>();

    for (const pattern of this.DOUYIN_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      
      while ((match = pattern.exec(text)) !== null) {
        const url = this.normalizeUrl(match[0]);
        
        // 避免重复
        if (!processedUrls.has(url)) {
          processedUrls.add(url);
          links.push({
            url,
            platform: 'douyin',
            originalText: text,
          });
        }
      }
    }

    logger.info('DouyinLinkExtractor', 'extractAllDouyinLinks', '提取到的链接数量', { 
      count: links.length, 
    });
    
    return links;
  }
}