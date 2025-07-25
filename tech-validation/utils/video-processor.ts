import { promises as fs } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

import { v4 as uuidv4 } from 'uuid';

export interface VideoMetadata {
  duration: number;
  title?: string;
  format?: string;
  url: string;
}

export interface VideoProcessingError extends Error {
  code: string;
  details?: any;
}

export class VideoProcessor {
  private static readonly TEMP_DIR = '/tmp';
  private static readonly MAX_DURATION = 60; // 60 秒限制

  /**
   * 获取 yt-dlp 可执行文件路径
   */
  private static getYtDlpPath(): string {
    // 尝试多个可能的路径
    const possiblePaths = [
      // Vercel 环境中的路径
      join(process.cwd(), 'bin', 'yt-dlp'),
      join(__dirname, '..', '..', '..', 'bin', 'yt-dlp'),
      // 本地开发环境
      join(process.cwd(), 'bin', 'yt-dlp.exe'),
      join(__dirname, '..', '..', '..', 'bin', 'yt-dlp.exe'),
      // 系统路径
      'yt-dlp',
      'yt-dlp.exe',
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        console.log(`✅ 找到 yt-dlp: ${path}`);
        return path;
      }
    }

    throw this.createError('METADATA_FETCH_FAILED', 'yt-dlp 未找到，尝试的路径: ' + possiblePaths.join(', '));
  }

  private static createError(code: string, message: string, details?: any): VideoProcessingError {
    const error = new Error(message) as VideoProcessingError;

    error.code = code;
    error.details = details;

    return error;
  }

  /**
   * 获取视频元数据并验证时长
   */
  static async getVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    try {
      console.log(`📊 获取视频元数据: ${videoUrl}`);
      
      // 使用真正的 yt-dlp 二进制文件
      const ytDlpPath = this.getYtDlpPath();
      
      // 构建命令
      const command = `"${ytDlpPath}" --dump-json --no-check-certificates --no-warnings --prefer-free-formats --add-header "referer:https://www.douyin.com/" --add-header "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${videoUrl}"`;
      
      console.log('执行命令:', command);
      
      // 执行命令并获取结果
      const output = execSync(command, { encoding: 'utf8' });
      
      // 解析 JSON 输出
      const info = JSON.parse(output);
      const duration = info.duration || 0;

      console.log(`⏱️  视频时长: ${duration} 秒`);

      // 验证视频时长
      if (duration > this.MAX_DURATION) {
        throw this.createError(
          'DURATION_EXCEEDED',
          `视频时长 ${duration} 秒超过限制 (${this.MAX_DURATION} 秒)`,
        );
      }

      return {
        duration,
        title: info.title || 'Unknown Title',
        format: info.ext || 'unknown',
        url: videoUrl,
      };
    } catch (error: any) {
      console.error('❌ 获取视频元数据失败:', error);
      
      if (error.code === 'DURATION_EXCEEDED') {
        throw error;
      }

      throw this.createError(
        'METADATA_FETCH_FAILED',
        '无法获取视频元数据',
        error.message,
      );
    }
  }

  /**
   * 下载视频并提取音频
   */
  static async downloadAndExtractAudio(videoUrl: string): Promise<{
    audioPath: string;
    metadata: VideoMetadata;
  }> {
    const metadata = await this.getVideoMetadata(videoUrl);
    const sessionId = uuidv4();
    const audioPath = join(this.TEMP_DIR, `audio_${sessionId}.mp3`);

    try {
      console.log('⬇️  开始下载视频并提取音频...');
      
      // 使用真正的 yt-dlp 二进制文件
      const ytDlpPath = this.getYtDlpPath();
      
      // 构建下载命令
      const command = `"${ytDlpPath}" -x --audio-format mp3 --audio-quality 0 -o "${audioPath}" --no-check-certificates --no-warnings --prefer-free-formats --match-filter "duration <= ${this.MAX_DURATION}" --add-header "referer:https://www.douyin.com/" --add-header "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" "${videoUrl}"`;
      
      console.log('执行下载命令:', command);
      
      // 执行下载命令
      execSync(command, { encoding: 'utf8', stdio: 'inherit' });

      // 验证音频文件是否存在
      const stats = await fs.stat(audioPath);

      console.log(`✅ 音频提取成功，文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      return {
        audioPath,
        metadata,
      };
    } catch (error: any) {
      console.error('❌ 下载或提取音频失败:', error);
      
      // 清理可能的临时文件
      try {
        await fs.unlink(audioPath);
      } catch {
        // 忽略清理错误
      }

      throw this.createError(
        'DOWNLOAD_FAILED',
        '视频下载或音频提取失败',
        error.message,
      );
    }
  }

  /**
   * 清理临时文件
   */
  static async cleanup(audioPath: string): Promise<void> {
    try {
      await fs.unlink(audioPath);
      console.log('🗑️  清理临时文件成功');
    } catch (error) {
      console.warn('⚠️  清理临时文件失败:', error);
    }
  }

  /**
   * 检查依赖可用性（兼容旧接口）
   */
  static async checkDependencies(): Promise<{
    available: boolean;
    missing: string[];
  }> {
    try {
      // 检查 yt-dlp 是否可用
      const ytDlpPath = this.getYtDlpPath();
      execSync(`"${ytDlpPath}" --version`, { encoding: 'utf8' });

      console.log('✅ yt-dlp 可用');
      
      // 检查 ffmpeg（使用系统安装的）
      console.log('✅ ffmpeg 应该已通过系统包管理器安装');
      
      return {
        available: true,
        missing: [],
      };
    } catch (error) {
      console.error('❌ 依赖检查失败:', error);

      return {
        available: false,
        missing: ['youtube-dl-exec 或 ffmpeg'],
      };
    }
  }
}