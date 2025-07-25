import { promises as fs } from 'fs';
import { join } from 'path';

import youtubedl from 'youtube-dl-exec';
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
      
      // 使用 youtube-dl-exec 获取视频信息
      const result = await youtubedl(videoUrl, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0'],
      });

      // 当使用 dumpSingleJson 时，返回的是视频信息对象
      if (typeof result === 'string') {
        throw this.createError('METADATA_FETCH_FAILED', '获取视频信息失败：返回格式错误');
      }

      const info = result as any; // 类型断言，youtube-dl-exec 的类型定义不完整
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
      
      // 使用 youtube-dl-exec 下载并转换为音频
      await youtubedl(videoUrl, {
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: 0,
        output: audioPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        // 限制下载时长
        matchFilter: `duration <= ${this.MAX_DURATION}`,
        // 添加必要的 headers 支持抖音等平台
        addHeader: [
          'referer:https://www.douyin.com/',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ],
        // 支持更多平台
        cookies: 'cookies.txt', // 如果需要的话
      });

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
      // 检查 youtube-dl-exec 是否可用
      await youtubedl('--version');

      console.log('✅ youtube-dl-exec 可用');
      
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