import { describe, it, expect } from '@jest/globals';

import { SecurityValidator } from '../utils/security-validator';

describe('SecurityValidator', () => {
  describe('validateVideoUrl', () => {
    describe('有效URL', () => {
      const validUrls = [
        'https://www.youtube.com/watch?v=123',
        'https://example.com/video.mp4',
        'http://cdn.example.com/videos/sample.mp4',
        'https://vimeo.com/123456789',
      ];
      
      validUrls.forEach((url) => {
        it(`应该接受有效URL: ${url}`, () => {
          const result = SecurityValidator.validateVideoUrl(url);

          expect(result.valid).toBe(true);
        });
      });
    });
    
    describe('SSRF防护', () => {
      const maliciousUrls = [
        // 本地地址
        { url: 'http://localhost/admin', reason: '不允许访问内网地址' },
        { url: 'http://127.0.0.1/api', reason: '不允许访问内网地址' },
        { url: 'https://[::1]/secret', reason: '不允许访问内网地址' },
        
        // 内网IP
        { url: 'http://10.0.0.1/internal', reason: '不允许访问内网地址' },
        { url: 'http://192.168.1.1/router', reason: '不允许访问内网地址' },
        { url: 'http://172.16.0.1/server', reason: '不允许访问内网地址' },
        { url: 'http://172.31.255.255/edge', reason: '不允许访问内网地址' },
        
        // Link-local
        { url: 'http://169.254.169.254/latest/meta-data/', reason: '不允许访问该主机' },
        { url: 'http://[fe80::1]/ipv6-local', reason: '不允许访问内网地址' },
        
        // 云服务元数据
        { url: 'http://metadata.google.internal/computeMetadata/v1/', reason: '不允许访问该主机' },
        { url: 'http://metadata.azure.com/metadata/', reason: '不允许访问该主机' },
        
        // 特殊地址
        { url: 'http://0.0.0.0:8080/any', reason: '不允许访问 0.0.0.0' },
        { url: 'http://255.255.255.255/broadcast', reason: '不允许访问广播地址' },
        
        // 内部域名
        { url: 'https://myservice.local/api', reason: '不允许访问内网地址' },
        { url: 'https://app.internal/admin', reason: '不允许访问内网地址' },
        { url: 'https://server.corp/data', reason: '不允许访问内网地址' },
        
        // URL欺骗
        { url: 'https://user:pass@example.com/video.mp4', reason: '不允许在URL中包含认证信息' },
        { url: 'https://admin@evil.com/hack', reason: '不允许在URL中包含认证信息' },
        
        // 危险端口
        { url: 'http://example.com:22/ssh', reason: '不允许访问端口 22' },
        { url: 'http://example.com:3306/mysql', reason: '不允许访问端口 3306' },
        { url: 'http://example.com:6379/redis', reason: '不允许访问端口 6379' },
      ];
      
      maliciousUrls.forEach(({ url, reason }) => {
        it(`应该阻止恶意URL: ${url}`, () => {
          const result = SecurityValidator.validateVideoUrl(url);

          expect(result.valid).toBe(false);
          expect(result.reason).toBe(reason);
        });
      });
    });
    
    describe('URL格式验证', () => {
      it('应该拒绝无效的URL格式', () => {
        const invalidUrls = [
          'not-a-url',
          'ftp://example.com/file.zip',
          'file:///etc/passwd',
          'javascript:alert(1)',
          'data:text/html,<script>alert(1)</script>',
        ];
        
        invalidUrls.forEach((url) => {
          const result = SecurityValidator.validateVideoUrl(url);

          expect(result.valid).toBe(false);
        });
      });
      
      it('应该拒绝过长的URL', () => {
        const longUrl = `https://example.com/${  'a'.repeat(2048)}`;
        const result = SecurityValidator.validateVideoUrl(longUrl);

        expect(result.valid).toBe(false);
        expect(result.reason).toContain('长度超过');
      });
    });
  });
  
  describe('validateApiToken', () => {
    it('应该接受有效的token', () => {
      const validTokens = [
        'abcdefghijklmnopqrstuvwxyz123456',
        'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6',
        'valid-token-with-hyphens-and_underscores_32chars',
      ];
      
      validTokens.forEach((token) => {
        const result = SecurityValidator.validateApiToken(token);

        expect(result.valid).toBe(true);
      });
    });
    
    it('应该拒绝无效的token', () => {
      const invalidTokens = [
        { token: '', reason: 'Token不能为空' },
        { token: 'short', reason: 'Token长度至少为32字符' },
        { token: 'a'.repeat(31), reason: 'Token长度至少为32字符' },
        { token: 'invalid token with spaces 123456', reason: 'Token包含非法字符' },
        { token: 'special@characters#not$allowed!!', reason: 'Token包含非法字符' },
        { token: 'test-tokenaaaaaaaaaaaaaaaaaaaaaa', reason: '不允许使用测试Token' },
        { token: '12345678901234567890123456789012', reason: '不允许使用测试Token' },
        { token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', reason: '不允许使用测试Token' },
      ];
      
      invalidTokens.forEach(({ token, reason }) => {
        const result = SecurityValidator.validateApiToken(token);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe(reason);
      });
    });
  });
  
  describe('validateAuthorizationHeader', () => {
    it('应该正确解析有效的Bearer token', () => {
      const result = SecurityValidator.validateAuthorizationHeader(
        'Bearer valid-token-1234567890123456789012345678',
      );

      expect(result.valid).toBe(true);
      expect(result.token).toBe('valid-token-1234567890123456789012345678');
    });
    
    it('应该拒绝无效的Authorization格式', () => {
      const invalidHeaders = [
        { header: undefined, reason: '缺少Authorization头' },
        { header: '', reason: '缺少Authorization头' },
        { header: 'Basic dXNlcjpwYXNz', reason: 'Authorization格式错误，应为 Bearer <token>' },
        { header: 'Bearer', reason: 'Authorization格式错误，应为 Bearer <token>' },
        { header: 'Bearer ', reason: 'Authorization格式错误，应为 Bearer <token>' },
        { header: 'Bearer short', reason: 'Token长度至少为32字符' },
      ];
      
      invalidHeaders.forEach(({ header, reason }) => {
        const result = SecurityValidator.validateAuthorizationHeader(header);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe(reason);
      });
    });
  });
  
  describe('validateStyle', () => {
    it('应该接受有效的style值', () => {
      const validStyles = ['default', 'humorous', 'professional', undefined];
      
      validStyles.forEach((style) => {
        const result = SecurityValidator.validateStyle(style);

        expect(result.valid).toBe(true);
      });
    });
    
    it('应该拒绝无效的style值', () => {
      const invalidStyles = [
        { style: 'invalid', reason: '无效的style参数，必须是: default, humorous, professional' },
        { style: '<script>alert(1)</script>', reason: 'style参数包含非法字符' },
        { style: 'default<img src=x>', reason: 'style参数包含非法字符' },
        { style: "'; DROP TABLE users; --", reason: 'style参数包含非法字符' },
      ];
      
      invalidStyles.forEach(({ style, reason }) => {
        const result = SecurityValidator.validateStyle(style);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe(reason);
      });
    });
  });
  
  describe('validateLanguage', () => {
    it('应该接受有效的语言代码', () => {
      const validLanguages = ['zh', 'en', 'zh-CN', 'en-US', undefined];
      
      validLanguages.forEach((language) => {
        const result = SecurityValidator.validateLanguage(language);

        expect(result.valid).toBe(true);
      });
    });
    
    it('应该拒绝无效的语言代码', () => {
      const invalidLanguages = [
        'chinese',
        'z',
        'zzz',
        'zh_CN',
        'en-us',
        '123',
      ];
      
      invalidLanguages.forEach((language) => {
        const result = SecurityValidator.validateLanguage(language);

        expect(result.valid).toBe(false);
        expect(result.reason).toBe('无效的语言代码格式');
      });
    });
  });
  
  describe('sanitizeForLogging', () => {
    it('应该清理危险字符', () => {
      const inputs = [
        { input: 'normal text', expected: 'normal text' },
        { input: 'text\nwith\nnewlines', expected: 'text with newlines' },
        { input: 'text\x00with\x1Fcontrol\x7Fchars', expected: 'textwithcontrolchars' },
        { input: 'a'.repeat(300), expected: 'a'.repeat(200) },
      ];
      
      inputs.forEach(({ input, expected }) => {
        const result = SecurityValidator.sanitizeForLogging(input);

        expect(result).toBe(expected);
      });
    });
  });
});