import { describe, it, expect } from '@jest/globals';
import { DouyinLinkExtractor } from '../utils/douyin-link-extractor';

describe('DouyinLinkExtractor', () => {
  describe('extractDouyinLink', () => {
    it('应该能提取短链接格式', () => {
      const text = '看看这个视频 https://v.douyin.com/iRyLb8kf/ 很有趣';
      const result = DouyinLinkExtractor.extractDouyinLink(text);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://v.douyin.com/iRyLb8kf');
      expect(result?.platform).toBe('douyin');
    });

    it('应该能提取完整链接格式', () => {
      const text = '分享一个视频 https://www.douyin.com/video/7123456789012345678';
      const result = DouyinLinkExtractor.extractDouyinLink(text);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://www.douyin.com/video/7123456789012345678');
      expect(result?.platform).toBe('douyin');
    });

    it('应该能处理带参数的链接', () => {
      const text = 'https://v.douyin.com/iRyLb8kf/?utm_source=copy_link 这是带参数的链接';
      const result = DouyinLinkExtractor.extractDouyinLink(text);
      
      expect(result).not.toBeNull();
      // normalizeUrl 会移除 utm 参数
      expect(result?.url).toBe('https://v.douyin.com/iRyLb8kf');
      expect(result?.platform).toBe('douyin');
    });

    it('应该能处理混合文本中的链接', () => {
      const text = '【抖音】看这个！！https://v.douyin.com/iRyLb8kf/！太好笑了';
      const result = DouyinLinkExtractor.extractDouyinLink(text);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://v.douyin.com/iRyLb8kf');
      expect(result?.platform).toBe('douyin');
    });

    it('没有链接时应返回 null', () => {
      const text = '这是一段没有链接的文本';
      const result = DouyinLinkExtractor.extractDouyinLink(text);
      
      expect(result).toBeNull();
    });
  });

  describe('normalizeUrl', () => {
    it('应该移除尾部的标点符号', () => {
      const url = 'https://v.douyin.com/iRyLb8kf/！';
      const normalized = DouyinLinkExtractor.normalizeUrl(url);
      
      expect(normalized).toBe('https://v.douyin.com/iRyLb8kf');
    });

    it('应该添加协议前缀', () => {
      const url = 'v.douyin.com/iRyLb8kf';
      const normalized = DouyinLinkExtractor.normalizeUrl(url);
      
      expect(normalized).toBe('https://v.douyin.com/iRyLb8kf');
    });

    it('应该移除追踪参数', () => {
      const url = 'https://v.douyin.com/iRyLb8kf/?utm_source=copy';
      const normalized = DouyinLinkExtractor.normalizeUrl(url);
      
      // 移除 utm 参数后，也会清理多余的 ? 
      expect(normalized).toBe('https://v.douyin.com/iRyLb8kf');
    });

    it('应该处理多个空格', () => {
      const url = 'https://v.douyin.com/iRyLb8kf/  ';
      const normalized = DouyinLinkExtractor.normalizeUrl(url);
      
      expect(normalized).toBe('https://v.douyin.com/iRyLb8kf');
    });
  });

  describe('extractVideoId', () => {
    it('应该从完整链接提取视频ID', () => {
      const url = 'https://www.douyin.com/video/7123456789012345678';
      const videoId = DouyinLinkExtractor.extractVideoId(url);
      
      expect(videoId).toBe('7123456789012345678');
    });

    it('应该从短链接提取ID', () => {
      const url = 'https://v.douyin.com/iRyLb8kf';
      const videoId = DouyinLinkExtractor.extractVideoId(url);
      
      expect(videoId).toBe('iRyLb8kf');
    });

    it('无效链接应返回 null', () => {
      const url = 'https://example.com/video';
      const videoId = DouyinLinkExtractor.extractVideoId(url);
      
      expect(videoId).toBeNull();
    });
  });

  describe('isValidDouyinUrl', () => {
    it('应该识别有效的短链接', () => {
      expect(DouyinLinkExtractor.isValidDouyinUrl('https://v.douyin.com/iRyLb8kf')).toBe(true);
    });

    it('应该识别有效的完整链接', () => {
      expect(DouyinLinkExtractor.isValidDouyinUrl('https://www.douyin.com/video/123456')).toBe(true);
    });

    it('应该拒绝无效链接', () => {
      expect(DouyinLinkExtractor.isValidDouyinUrl('https://youtube.com/watch?v=123')).toBe(false);
    });

    it('应该拒绝空值', () => {
      expect(DouyinLinkExtractor.isValidDouyinUrl('')).toBe(false);
    });
  });

  describe('extractAllDouyinLinks', () => {
    it('应该提取所有抖音链接', () => {
      const text = `
        第一个视频：https://v.douyin.com/iRyLb8kf/
        第二个视频：https://www.douyin.com/video/7123456789012345678
        第三个视频：https://v.douyin.com/abcdefg/
      `;
      
      const links = DouyinLinkExtractor.extractAllDouyinLinks(text);
      
      expect(links).toHaveLength(3);
      // 验证包含所有链接，不关心顺序
      const urls = links.map(l => l.url);
      expect(urls).toContain('https://v.douyin.com/iRyLb8kf');
      expect(urls).toContain('https://www.douyin.com/video/7123456789012345678');
      expect(urls).toContain('https://v.douyin.com/abcdefg');
    });

    it('应该去重复链接', () => {
      const text = `
        看这个：https://v.douyin.com/iRyLb8kf/
        再看一次：https://v.douyin.com/iRyLb8kf/
      `;
      
      const links = DouyinLinkExtractor.extractAllDouyinLinks(text);
      
      expect(links).toHaveLength(1);
      expect(links[0].url).toBe('https://v.douyin.com/iRyLb8kf');
    });

    it('没有链接时应返回空数组', () => {
      const text = '这是一段没有抖音链接的文本';
      const links = DouyinLinkExtractor.extractAllDouyinLinks(text);
      
      expect(links).toHaveLength(0);
    });
  });
});