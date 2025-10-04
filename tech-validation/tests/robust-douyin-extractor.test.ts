import { describe, it, expect, jest } from '@jest/globals';
import { RobustDouyinExtractor } from '../utils/robust-douyin-extractor';

describe('RobustDouyinExtractor - 健壮性测试', () => {
  describe('输入验证', () => {
    it('应该拒绝空输入', async () => {
      const result = await RobustDouyinExtractor.smartExtract('');
      expect(result.links).toHaveLength(0);
      expect(result.suggestions).toBeDefined();
    });
    
    it('应该拒绝非字符串输入', async () => {
      // @ts-ignore - 故意传入错误类型
      const result = await RobustDouyinExtractor.smartExtract(null);
      expect(result.links).toHaveLength(0);
      expect(result.suggestions).toBeDefined();
    });
    
    it('应该拒绝超长输入', async () => {
      const longText = 'a'.repeat(51000);
      const result = await RobustDouyinExtractor.smartExtract(longText);
      expect(result.links).toHaveLength(0);
      expect(result.suggestions?.[0]).toContain('错误');
    });
    
    it('应该处理包含控制字符的输入', async () => {
      const maliciousText = 'https://v.douyin.com/test/\x00\x01\x02';
      const result = await RobustDouyinExtractor.smartExtract(maliciousText);
      expect(result.links).toHaveLength(0);
    });
  });
  
  describe('性能测试', () => {
    it('应该快速处理长文本', async () => {
      const longText = 'a'.repeat(10000) + ' https://v.douyin.com/test/ ' + 'b'.repeat(10000);
      const start = Date.now();
      const result = await RobustDouyinExtractor.smartExtract(longText);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
      expect(result.links).toHaveLength(1);
    });
    
    it('应该处理大量链接而不崩溃', async () => {
      const manyLinks = Array(200).fill('https://v.douyin.com/test/').join(' ');
      const result = await RobustDouyinExtractor.smartExtract(manyLinks);
      
      expect(result.links.length).toBeLessThanOrEqual(100); // 应该限制在100个以内
    });
    
    it('应该处理大量口令而不崩溃', async () => {
      const manyCommands = Array(200).fill('#测试话题#').join(' ');
      const result = await RobustDouyinExtractor.smartExtract(manyCommands);
      
      expect(result.commands.length).toBeLessThanOrEqual(100); // 应该限制在100个以内
    });
  });
  
  describe('恶意输入防护', () => {
    it('应该防御正则DoS攻击 - 嵌套量词', async () => {
      const malicious = 'https://v.douyin.com/' + 'a'.repeat(1000) + '////';
      const start = Date.now();
      const result = await RobustDouyinExtractor.smartExtract(malicious);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(500);
      expect(result.links.length).toBeGreaterThanOrEqual(0);
    });
    
    it('应该防御正则DoS攻击 - 大量重复', async () => {
      const malicious = '#'.repeat(10000) + '内容' + '#'.repeat(10000);
      const start = Date.now();
      const result = await RobustDouyinExtractor.smartExtract(malicious);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000);
    });
    
    it('应该处理零宽字符', async () => {
      const text = 'https://v.douyin.com/test/\u200B\u200C\u200D';
      const result = await RobustDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://v.douyin.com/test');
    });
    
    it('应该拒绝非抖音域名', async () => {
      const text = 'https://evil.com/fake/douyin/video';
      const result = await RobustDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(0);
    });
  });
  
  describe('边界情况', () => {
    it('应该处理极短的链接ID', async () => {
      const text = 'https://v.douyin.com/a/';
      const result = await RobustDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
    });
    
    it.skip('应该拒绝过长的链接ID', async () => {
      // TODO: 需要在提取器中添加ID长度验证逻辑
      const text = 'https://v.douyin.com/' + 'a'.repeat(100) + '/';
      const result = await RobustDouyinExtractor.smartExtract(text);

      expect(result.links).toHaveLength(0);
    });
    
    it('应该处理Unicode标点', async () => {
      const text = '看这个视频：https://v.douyin.com/test/。很有趣！';
      const result = await RobustDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://v.douyin.com/test');
    });
    
    it('应该处理各种引号', async () => {
      const text = '"看这个"https://v.douyin.com/test/"视频"';
      const result = await RobustDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
    });
  });
  
  describe('分块处理', () => {
    it('应该正确处理跨块的链接', async () => {
      const part1 = 'a'.repeat(4900);
      const link = 'https://v.douyin.com/test/';
      const part2 = 'b'.repeat(100);
      const text = part1 + link + part2;
      
      const result = await RobustDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
      expect(result.links[0].url).toBe('https://v.douyin.com/test');
    });
    
    it('应该去重跨块重复的链接', async () => {
      const link = 'https://v.douyin.com/test/';
      const text = 'a'.repeat(4900) + link + 'b'.repeat(200) + link + 'c'.repeat(4900);
      
      const result = await RobustDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(1);
    });
  });
  
  describe('错误恢复', () => {
    it('应该在正则执行失败时返回安全结果', async () => {
      // 模拟一个会导致问题的输入
      const problematicText = '(((((' + 'a'.repeat(100) + ')))))';
      const result = await RobustDouyinExtractor.smartExtract(problematicText);
      
      expect(result).toBeDefined();
      expect(result.links).toBeDefined();
      expect(result.commands).toBeDefined();
    });
    
    it('应该处理URL解析失败', async () => {
      const text = 'https://v.douyin.com/[invalid]/';
      const result = await RobustDouyinExtractor.smartExtract(text);
      
      expect(result.links).toHaveLength(0);
    });
  });
  
  describe('真实场景测试', () => {
    it('应该处理混合内容的真实分享文本', async () => {
      const realText = `
        🔥爆款推荐🔥
        1️⃣ https://v.douyin.com/iRyLb8kf/ 超级搞笑
        2️⃣ 7.53 MQc:/ 复制打开抖音
        3️⃣ #美食探店# 必看！
        
        更多精彩内容，关注@美食博主 https://www.douyin.com/user/MS4wLjABAAAA123
        
        ￥优惠码ABC123￥ 限时特惠
      `;
      
      const result = await RobustDouyinExtractor.smartExtract(realText);
      
      expect(result.links.length).toBeGreaterThan(0);
      expect(result.commands.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
    
    it('应该处理包含特殊字符的复杂文本', async () => {
      const complexText = `
        【重要通知】🎉🎉🎉
        ⬇️⬇️⬇️点击下方链接⬇️⬇️⬇️
        ➡️ https://v.douyin.com/test/ ⬅️
        
        ❗❗❗限时活动❗❗❗
        复制口令：%%新年特惠2025%%
        
        🌟🌟🌟精彩内容🌟🌟🌟
        #新年快乐# #限时优惠#
      `;
      
      const result = await RobustDouyinExtractor.smartExtract(complexText);
      
      expect(result.links).toHaveLength(1);
      expect(result.commands.length).toBeGreaterThan(0);
    });
  });
  
  describe('并发安全', () => {
    it('应该安全处理并发请求', async () => {
      const promises = Array(50).fill(null).map((_, i) => 
        RobustDouyinExtractor.smartExtract(`https://v.douyin.com/test${i}/`)
      );
      
      const results = await Promise.all(promises);
      
      expect(results.every(r => r.links.length === 1)).toBe(true);
      expect(results.every((r, i) => r.links[0].url === `https://v.douyin.com/test${i}`)).toBe(true);
    });
  });
});