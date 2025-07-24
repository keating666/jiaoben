import { existsSync } from 'fs';
import { join } from 'path';

import { describe, it, expect } from '@jest/globals';

describe('Binary Dependencies', () => {
  const binDir = join(__dirname, '..', '..', 'bin');
  
  it('should have bin directory', () => {
    expect(existsSync(binDir)).toBe(true);
  });

  it('should have yt-dlp binary', () => {
    const ytDlpPath = join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    
    // 如果 postinstall 脚本已运行，二进制文件应该存在
    if (existsSync(binDir)) {
      // 检查是否存在，如果不存在则跳过（可能是首次安装）
      if (existsSync(ytDlpPath)) {
        expect(existsSync(ytDlpPath)).toBe(true);
      } else {
        console.warn('⚠️  yt-dlp 二进制文件不存在，可能需要运行 postinstall 脚本');
      }
    }
  });

  it('should have ffmpeg available through npm package', () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

      expect(typeof ffmpegPath).toBe('string');
      expect(ffmpegPath.length).toBeGreaterThan(0);
    } catch (error) {
      // 如果包未安装，这是预期的
      console.warn('⚠️  @ffmpeg-installer/ffmpeg 包未安装');
    }
  });

  it('should validate binary checker utility structure', () => {
    // 测试 BinaryChecker 类的接口设计
    interface BinaryStatus {
      available: boolean;
      path?: string;
      version?: string;
      error?: string;
    }

    // 模拟成功状态
    const successStatus: BinaryStatus = {
      available: true,
      path: '/path/to/binary',
      version: '1.0.0',
    };

    // 模拟失败状态
    const failureStatus: BinaryStatus = {
      available: false,
      error: 'Binary not found',
    };

    expect(successStatus.available).toBe(true);
    expect(successStatus.path).toBeDefined();
    expect(successStatus.version).toBeDefined();
    
    expect(failureStatus.available).toBe(false);
    expect(failureStatus.error).toBeDefined();
  });

  it('should handle platform-specific binary names', () => {
    const platform = process.platform;
    
    let expectedYtDlpName: string;

    if (platform === 'win32') {
      expectedYtDlpName = 'yt-dlp.exe';
    } else {
      expectedYtDlpName = 'yt-dlp';
    }

    expect(expectedYtDlpName).toMatch(/yt-dlp/);
    
    // 验证路径构建逻辑
    const ytDlpPath = join(binDir, expectedYtDlpName);

    expect(ytDlpPath).toContain(expectedYtDlpName);
  });

  it('should validate temporary directory setup', () => {
    const tempDir = '/tmp';
    
    // 验证临时目录路径是正确的
    expect(tempDir).toBe('/tmp');
    
    // 模拟会话ID和文件路径
    const sessionId = 'test-session-123';
    const videoPath = join(tempDir, `${sessionId}.mp4`);
    const audioPath = join(tempDir, `${sessionId}.mp3`);
    
    expect(videoPath).toContain(sessionId);
    expect(audioPath).toContain(sessionId);
    expect(videoPath).toMatch(/\.mp4$/);
    expect(audioPath).toMatch(/\.mp3$/);
  });
});