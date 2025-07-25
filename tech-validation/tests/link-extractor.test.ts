import { describe, it, expect } from '@jest/globals';

import { LinkExtractor } from '../utils/link-extractor';

describe('LinkExtractor', () => {
  describe('extractVideoLink', () => {
    it('should extract Douyin link from mixed text', () => {
      const text = `9.20 c@a.nd 01/22 ygo:/ 至于为什么周六不更，我的粉丝自会在评论区给出答案。 
      # 被盗视频 # 沙雕动画 # 二次元 # 原创动画 # 别划走  
      https://v.douyin.com/7Ygkcv5qidM/ 复制此链接，打开Dou音搜索，直接观看视频！`;
      
      const result = LinkExtractor.extractVideoLink(text);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://v.douyin.com/7Ygkcv5qidM/');
      expect(result?.platform).toBe('douyin');
    });

    it('should extract YouTube link from mixed text', () => {
      const text = `Check out this amazing video! 
      https://www.youtube.com/watch?v=dQw4w9WgXcQ 
      Don't forget to like and subscribe!`;
      
      const result = LinkExtractor.extractVideoLink(text);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result?.platform).toBe('youtube');
    });

    it('should extract YouTube shorts link', () => {
      const text = '新视频上线啦！https://www.youtube.com/shorts/abcd1234';
      
      const result = LinkExtractor.extractVideoLink(text);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://www.youtube.com/shorts/abcd1234');
      expect(result?.platform).toBe('youtube');
    });

    it('should extract TikTok link from mixed text', () => {
      const text = `Amazing dance moves! 
      https://www.tiktok.com/@username/video/7123456789012345678 
      #dance #viral`;
      
      const result = LinkExtractor.extractVideoLink(text);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://www.tiktok.com/@username/video/7123456789012345678');
      expect(result?.platform).toBe('tiktok');
    });

    it('should return null if no video link found', () => {
      const text = '这是一段没有链接的文本';
      
      const result = LinkExtractor.extractVideoLink(text);
      
      expect(result).toBeNull();
    });

    it('should extract generic URL if no specific platform matched', () => {
      const text = '看看这个视频 https://example.com/video.mp4 很有意思';
      
      const result = LinkExtractor.extractVideoLink(text);
      
      expect(result).not.toBeNull();
      expect(result?.url).toBe('https://example.com/video.mp4');
      expect(result?.platform).toBe('other');
    });
  });

  describe('cleanUrl', () => {
    it('should remove trailing punctuation', () => {
      const url = 'https://v.douyin.com/abc123/！';
      const cleaned = LinkExtractor.cleanUrl(url);

      expect(cleaned).toBe('https://v.douyin.com/abc123/');
    });

    it('should remove tracking parameters', () => {
      const url = 'https://www.youtube.com/watch?v=abc123&utm_source=share&utm_medium=web';
      const cleaned = LinkExtractor.cleanUrl(url);

      expect(cleaned).toBe('https://www.youtube.com/watch?v=abc123');
    });

    it('should add https protocol if missing', () => {
      const url = 'v.douyin.com/abc123/';
      const cleaned = LinkExtractor.cleanUrl(url);

      expect(cleaned).toBe('https://v.douyin.com/abc123/');
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(LinkExtractor.isValidUrl('https://www.youtube.com/watch?v=abc123')).toBe(true);
      expect(LinkExtractor.isValidUrl('http://example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(LinkExtractor.isValidUrl('not-a-url')).toBe(false);
      expect(LinkExtractor.isValidUrl('ftp://example.com')).toBe(false);
      expect(LinkExtractor.isValidUrl('')).toBe(false);
    });
  });
});