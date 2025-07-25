import { promises as fs } from 'fs';
import { join } from 'path';
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
      
      // 在 Vercel 环境中，直接使用备用方案（跳过 Replit）
      if (process.env.VERCEL) {
        console.log('⚠️  Vercel 环境，使用模拟数据');
        
        // 直接返回模拟的视频元数据
        return {
          duration: 30,
          title: '测试视频',
          format: 'mp4',
          url: videoUrl,
        };
      }
      
      // 本地开发环境可以使用 youtube-dl-exec
      const youtubedl = (await import('youtube-dl-exec')).default;
      const info = await youtubedl(videoUrl, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        // youtubeDl: 'yt-dlp', // 注释掉，youtube-dl-exec 2.x 自动使用 yt-dlp
        addHeader: [
          'referer:https://www.douyin.com/',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        ],
      });
      
      const duration = (info as any).duration || 0;

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
        title: (info as any).title || 'Unknown Title',
        format: (info as any).ext || 'unknown',
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
      
      // 在 Vercel 环境中，直接创建模拟音频
      if (process.env.VERCEL) {
        console.log('⚠️  Vercel 环境，创建模拟音频文件');
        
        const { createMockAudioFile } = await import('./mock-audio');
        const { v4: uuidv4 } = await import('uuid');
        
        const audioPath = `/tmp/mock_audio_${uuidv4()}.mp3`;
        await createMockAudioFile(audioPath);
        
        console.log(`✅ 模拟音频创建完成: ${audioPath}`);
        
        return {
          audioPath,
          metadata
        };
      } else {
        // 本地开发环境使用 youtube-dl-exec
        const youtubedl = (await import('youtube-dl-exec')).default;
        await youtubedl(videoUrl, {
          extractAudio: true,
          audioFormat: 'mp3',
          audioQuality: 0,
          output: audioPath,
          noCheckCertificates: true,
          noWarnings: true,
          preferFreeFormats: true,
          // youtubeDl: 'yt-dlp', // 注释掉，youtube-dl-exec 2.x 自动使用 yt-dlp
          matchFilter: `duration <= ${this.MAX_DURATION}`,
          addHeader: [
            'referer:https://www.douyin.com/',
            'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          ],
        });
      }

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
      if (process.env.VERCEL) {
        console.log('⚠️  Vercel 环境检测：缺少 Python 运行时');
        return {
          available: false,
          missing: ['Python 运行时（Vercel 限制）'],
        };
      }
      
      // 本地环境检查
      const youtubedl = (await import('youtube-dl-exec')).default;
      const version = await youtubedl('--version', {
        // youtubeDl: 'yt-dlp', // 注释掉，youtube-dl-exec 2.x 自动使用 yt-dlp
      });

      console.log('✅ yt-dlp 可用，版本:', version);
      console.log('✅ youtube-dl-exec 会自动管理 ffmpeg');
      
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