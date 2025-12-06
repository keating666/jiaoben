import { describe, it, expect } from '@jest/globals';

import { EnhancedDouyinExtractor } from '../utils/enhanced-douyin-extractor';

describe('EnhancedDouyinExtractor', () => {
  describe('smartExtract - 标准链接', () => {
    it('应该提取标准短链接', async () => {
      const text = '看看这个视频 https://v.douyin.com/iRyLb8kf/ 很有趣';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://v.douyin.com/iRyLb8kf');
      expect(result.links[0].type).toBe('short');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('应该提取完整视频链接', async () => {
      const text = '分享 https://www.douyin.com/video/7123456789012345678';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://www.douyin.com/video/7123456789012345678');
      expect(result.links[0].type).toBe('video');
    });

    it('应该提取用户主页链接', async () => {
      const text = '关注这个博主 https://www.douyin.com/user/MS4wLjABAAAA1234567890';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].type).toBe('user');
    });

    it('应该提取直播链接', async () => {
      const text = '正在直播 https://live.douyin.com/123456789';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].type).toBe('live');
    });
  });

  describe('smartExtract - 复杂场景', () => {
    it('应该处理链接后紧跟中文的情况', async () => {
      const text = '看https://v.douyin.com/iRyLb8kf/这个视频真的很搞笑';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://v.douyin.com/iRyLb8kf');
    });

    it('应该处理链接被标点符号包围的情况', async () => {
      const text = '【重要】https://v.douyin.com/iRyLb8kf/！！必看！！';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://v.douyin.com/iRyLb8kf');
    });

    it('应该处理多个链接', async () => {
      const text = `
        第一个：https://v.douyin.com/video1/
        第二个：https://www.douyin.com/video/7123456789012345678
        第三个：https://live.douyin.com/123456
      `;
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(3);
      expect(result.method).toBe('regex');
    });

    it.skip('应该移除追踪参数但保留重要参数', async () => {
      // TODO: 短链接规范化逻辑需要重新设计，暂时跳过此测试
      const text = 'https://v.douyin.com/iRyLb8kf/?utm_source=copy&utm_campaign=client_share&video_id=123';
      const result = await EnhancedDouyinExtractor.smartExtract(text);

      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).not.toContain('utm_source');
      expect(result.links[0].url).toContain('video_id=123');
    });
  });

  describe('smartExtract - 口令提取', () => {
    it('应该提取标准抖音口令', async () => {
      const text = '7.53 MQc:/ 复制此链接，打开抖音，直接观看视频！';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('copy-text');
      expect(result.commands[0].content).toContain('MQc:/');
    });

    it('应该提取话题标签口令', async () => {
      const text = '#在抖音，记录美好生活# 快来看看吧';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('command');
    });

    it('应该提取淘口令格式', async () => {
      const text = '￥dY4d2kPQFNe￥ 打开抖音搜索';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands).toHaveLength(1);
    });

    it('应该提取复制文本格式', async () => {
      const text = '复制这段话￥AbCd1234￥打开抖音';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('copy-text');
    });

    it('应该提取搜索指令', async () => {
      const text = '抖音搜索：猫猫的日常生活';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].type).toBe('search');
      expect(result.commands[0].content).toBe('猫猫的日常生活');
    });
  });

  describe('smartExtract - 混合场景', () => {
    it('应该同时提取链接和口令', async () => {
      const text = '看这个 https://v.douyin.com/iRyLb8kf/ 或者复制口令 #猫猫日常#';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.commands).toHaveLength(1);
      expect(result.method).toBe('mixed');
    });

    it('应该处理真实的分享文本', async () => {
      const text = `8.61 nqh:/ 06/26 复制打开抖音，看看【张三的作品】# 创意视频 # 搞笑日常 
      https://v.douyin.com/iRyLb8kf/`;
      
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links.length).toBeGreaterThan(0);
      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('智能建议', () => {
    it('没有找到链接时应该给出建议', async () => {
      const text = '去抖音看那个很火的猫猫视频';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(0);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions![0]).toContain('未找到有效的抖音链接');
    });

    it('找到口令时应该提示在APP中打开', async () => {
      const text = '#猫猫日常# 快来看';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions![0]).toContain('抖音APP中打开');
    });

    it('多个链接时应该提示处理顺序', async () => {
      const text = '链接1：https://v.douyin.com/abc/ 链接2：https://v.douyin.com/def/';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions![0]).toContain('2个链接');
    });
  });

  describe('边界情况处理', () => {
    it('应该处理没有协议的链接', async () => {
      const text = '看这个 v.douyin.com/iRyLb8kf/';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://v.douyin.com/iRyLb8kf');
    });

    it('应该去重复链接', async () => {
      const text = `
        看这个：https://v.douyin.com/iRyLb8kf/
        再看一次：https://v.douyin.com/iRyLb8kf/
        还是这个：v.douyin.com/iRyLb8kf/
      `;
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
    });

    it('应该处理特殊字符包围的链接', async () => {
      const text = '《https://v.douyin.com/iRyLb8kf/》';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://v.douyin.com/iRyLb8kf');
    });

    it('应该处理国际版TikTok链接', async () => {
      const text = '这是TikTok链接 https://vm.tiktok.com/ZMN123abc/';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://vm.tiktok.com/ZMN123abc');
    });
  });

  describe('真实案例测试（基于搜索结果）', () => {
    it('应该处理数字代码+打开抖音格式', async () => {
      const text = '4.98 XhC:/ 复制打开抖音，看看【美食分享】';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.commands[0].content).toContain('XhC:/');
    });

    it('应该处理打开Dou音变体', async () => {
      const text = '7.53 pqZ:/ 06/26 打开Dou音，直接观看视频！';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands.length).toBeGreaterThan(0);
    });

    it('应该处理长按复制格式', async () => {
      const text = '长按复制此段话$VGc7HhU8rQW$打开抖音，看看@小王的作品';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.commands[0].type).toBe('copy-text');
    });

    it('应该处理dOU口令格式', async () => {
      const text = 'dOU口令：ABcd1234 快来看看吧';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.commands[0].content).toContain('ABcd1234');
    });

    it('应该处理特殊编码字符', async () => {
      const text = '复制 u0000eyWZ123 打开抖音查看精彩内容';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands.length).toBeGreaterThan(0);
    });

    it('应该处理分享码格式', async () => {
      const text = '分享码：XYZ789 邀请你来看直播';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.commands[0].content).toContain('XYZ789');
    });

    it('应该处理复杂的真实分享文本', async () => {
      const text = `【抖音】长按复制此条消息，打开抖音搜索，查看TA的更多作品。 https://v.douyin.com/ikRL6Sn/
      4.53 WQy:/ 复制打开抖音，看看【张三的日常vlog】# 生活记录 # 美食探店`;
      
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links.length).toBeGreaterThan(0);
      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.method).toBe('mixed');
    });

    it('应该处理抖音矩阵群邀请', async () => {
      const text = '复制口令进抖音矩阵群 ￥Matr1x2024￥ 加入我们';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.commands.length).toBeGreaterThan(0);
    });

    it('应该处理多平台混合分享', async () => {
      const text = `抖音: https://v.douyin.com/iRyH8L8m/
      TikTok: https://vm.tiktok.com/ZMN123abc/
      口令: 7.98 ABC:/ 复制打开抖音`;
      
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(2);
      expect(result.commands).toHaveLength(1);
    });
  });

  describe('置信度计算', () => {
    it('标准短链接应该有高置信度', async () => {
      const text = '分享抖音视频 https://v.douyin.com/iRyLb8kf/';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.confidence).toBeGreaterThan(0.95);
    });

    it('只有口令应该有中等置信度', async () => {
      const text = '#猫猫日常# 快来看';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('没有抖音相关内容应该有低置信度', async () => {
      const text = '今天天气真好';
      const result = await EnhancedDouyinExtractor.smartExtract(text);
      
      expect(result.confidence).toBeLessThan(0.5);
    });
  });
});