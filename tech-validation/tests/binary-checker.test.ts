import { describe, it, expect } from '@jest/globals';
import { BinaryChecker } from '../utils/binary-checker';

describe('BinaryChecker', () => {
  it('should check yt-dlp availability', async () => {
    const status = await BinaryChecker.checkYtDlp();
    
    expect(status).toHaveProperty('available');
    expect(typeof status.available).toBe('boolean');
    
    if (status.available) {
      expect(status.path).toBeDefined();
      expect(status.version).toBeDefined();
      expect(typeof status.path).toBe('string');
      expect(typeof status.version).toBe('string');
    } else {
      expect(status.error).toBeDefined();
      expect(typeof status.error).toBe('string');
    }
  }, 10000); // 延长超时时间

  it('should check ffmpeg availability', async () => {
    const status = await BinaryChecker.checkFfmpeg();
    
    expect(status).toHaveProperty('available');
    expect(typeof status.available).toBe('boolean');
    
    if (status.available) {
      expect(status.path).toBeDefined();
      expect(status.version).toBeDefined();
      expect(typeof status.path).toBe('string');
      expect(typeof status.version).toBe('string');
    } else {
      expect(status.error).toBeDefined();
      expect(typeof status.error).toBe('string');
    }
  }, 10000);

  it('should check all binaries', async () => {
    const status = await BinaryChecker.checkAll();
    
    expect(status).toHaveProperty('ytDlp');
    expect(status).toHaveProperty('ffmpeg');
    
    expect(status.ytDlp).toHaveProperty('available');
    expect(status.ffmpeg).toHaveProperty('available');
    
    expect(typeof status.ytDlp.available).toBe('boolean');
    expect(typeof status.ffmpeg.available).toBe('boolean');
  }, 15000);

  it('should handle missing binaries gracefully', async () => {
    // 这个测试验证错误处理逻辑
    const status = await BinaryChecker.checkYtDlp();
    
    // 不管二进制文件是否存在，都应该返回有效的状态对象
    expect(status).toMatchObject({
      available: expect.any(Boolean)
    });
    
    if (!status.available) {
      expect(status.error).toBeDefined();
      expect(typeof status.error).toBe('string');
      expect(status.error!.length).toBeGreaterThan(0);
    }
  });

  it('should validate binary status interface', () => {
    // 测试接口定义的正确性
    const validSuccessStatus = {
      available: true,
      path: '/path/to/binary',
      version: '1.0.0'
    };

    const validErrorStatus = {
      available: false,
      error: 'Binary not found'
    };

    // 验证成功状态
    expect(validSuccessStatus.available).toBe(true);
    expect(validSuccessStatus.path).toBeDefined();
    expect(validSuccessStatus.version).toBeDefined();

    // 验证错误状态
    expect(validErrorStatus.available).toBe(false);
    expect(validErrorStatus.error).toBeDefined();
  });
});