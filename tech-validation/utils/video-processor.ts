import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';

import { BinaryChecker } from './binary-checker';

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
    await BinaryChecker.ensureAvailable();
    
    const status = await BinaryChecker.checkYtDlp();

    if (!status.available) {
      throw this.createError('BINARY_NOT_AVAILABLE', 'yt-dlp 不可用', status.error);
    }

    try {
      console.log(`📊 获取视频元数据: ${videoUrl}`);
      
      // 使用 yt-dlp 获取视频信息（JSON 格式）
      const command = `"${status.path}" --print-json --no-download "${videoUrl}"`;
      
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 10000, // 10 秒超时
        maxBuffer: 1024 * 1024, // 1MB 缓冲区
      });

      const metadata = JSON.parse(output.trim());
      
      // 提取关键信息
      const duration = metadata.duration || 0;
      const title = metadata.title || 'Unknown Title';
      const format = metadata.ext || 'unknown';

      console.log(`📊 视频信息: ${title}, 时长: ${duration}秒, 格式: ${format}`);

      // 检查时长限制
      if (duration > this.MAX_DURATION) {
        throw this.createError('VIDEO_TOO_LONG', '视频时长超过60秒限制', {
          duration,
          limit: this.MAX_DURATION,
          video_url: videoUrl,
        });
      }

      return {
        duration,
        title,
        format,
        url: videoUrl,
      };

    } catch (error) {
      if (error instanceof Error && (error as VideoProcessingError).code) {
        throw error; // 重新抛出已知错误
      }

      console.error('获取视频元数据失败:', error);
      
      // 解析常见的 yt-dlp 错误
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Unsupported URL')) {
        throw this.createError('UNSUPPORTED_URL', '不支持的视频链接', { video_url: videoUrl });
      }
      
      if (errorMessage.includes('Video unavailable')) {
        throw this.createError('VIDEO_UNAVAILABLE', '视频不可用或已被删除', { video_url: videoUrl });
      }
      
      if (errorMessage.includes('Private video')) {
        throw this.createError('PRIVATE_VIDEO', '无法访问私有视频', { video_url: videoUrl });
      }

      throw this.createError('METADATA_FETCH_FAILED', '获取视频元数据失败', { 
        video_url: videoUrl,
        error: errorMessage, 
      });
    }
  }

  /**
   * 下载视频到临时目录
   */
  static async downloadVideo(videoUrl: string, sessionId: string): Promise<string> {
    await BinaryChecker.ensureAvailable();
    
    const status = await BinaryChecker.checkYtDlp();

    if (!status.available) {
      throw this.createError('BINARY_NOT_AVAILABLE', 'yt-dlp 不可用', status.error);
    }

    const videoPath = join(this.TEMP_DIR, `${sessionId}.%(ext)s`);
    const finalVideoPath = join(this.TEMP_DIR, `${sessionId}.mp4`);

    try {
      console.log(`⬇️  下载视频到: ${videoPath}`);
      
      // 使用 yt-dlp 下载视频，强制 mp4 格式
      const command = `"${status.path}" --format "best[ext=mp4]/best" --output "${videoPath}" "${videoUrl}"`;
      
      execSync(command, {
        encoding: 'utf8',
        timeout: 30000, // 30 秒超时
        maxBuffer: 10 * 1024 * 1024, // 10MB 缓冲区
      });

      // 检查下载的文件
      const files = await fs.readdir(this.TEMP_DIR);
      const downloadedFile = files.find((file) => file.startsWith(sessionId));
      
      if (!downloadedFile) {
        throw this.createError('DOWNLOAD_FAILED', '视频下载失败，未找到下载的文件');
      }

      const actualPath = join(this.TEMP_DIR, downloadedFile);
      
      // 如果文件不是 .mp4 格式，重命名为 .mp4
      if (actualPath !== finalVideoPath) {
        await fs.rename(actualPath, finalVideoPath);
      }

      // 验证文件大小
      const stats = await fs.stat(finalVideoPath);

      console.log(`✅ 视频下载成功: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);

      return finalVideoPath;

    } catch (error) {
      console.error('视频下载失败:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('timeout')) {
        throw this.createError('DOWNLOAD_TIMEOUT', '视频下载超时', { video_url: videoUrl });
      }
      
      if (errorMessage.includes('No space left')) {
        throw this.createError('INSUFFICIENT_SPACE', '磁盘空间不足', { video_url: videoUrl });
      }

      throw this.createError('VIDEO_DOWNLOAD_FAILED', '视频下载失败', { 
        video_url: videoUrl,
        error: errorMessage, 
      });
    }
  }

  /**
   * 从视频中提取音频
   */
  static async extractAudio(videoPath: string, sessionId: string): Promise<string> {
    await BinaryChecker.ensureAvailable();
    
    const status = await BinaryChecker.checkFfmpeg();

    if (!status.available) {
      throw this.createError('BINARY_NOT_AVAILABLE', 'ffmpeg 不可用', status.error);
    }

    const audioPath = join(this.TEMP_DIR, `${sessionId}.mp3`);

    try {
      console.log(`🎵 提取音频: ${videoPath} -> ${audioPath}`);
      
      // 使用 ffmpeg 提取音频为 mp3 格式
      const command = `"${status.path}" -i "${videoPath}" -vn -acodec mp3 -ab 128k -ar 44100 -y "${audioPath}"`;
      
      execSync(command, {
        encoding: 'utf8',
        timeout: 15000, // 15 秒超时
        maxBuffer: 5 * 1024 * 1024, // 5MB 缓冲区
      });

      // 验证音频文件
      const stats = await fs.stat(audioPath);

      console.log(`✅ 音频提取成功: ${(stats.size / 1024).toFixed(2)}KB`);

      return audioPath;

    } catch (error) {
      console.error('音频提取失败:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('timeout')) {
        throw this.createError('AUDIO_EXTRACTION_TIMEOUT', '音频提取超时');
      }
      
      if (errorMessage.includes('No audio')) {
        throw this.createError('NO_AUDIO_STREAM', '视频中没有音频流');
      }

      throw this.createError('AUDIO_EXTRACTION_FAILED', '音频提取失败', { 
        video_path: videoPath,
        error: errorMessage, 
      });
    }
  }

  /**
   * 清理临时文件
   */
  static async cleanup(sessionId: string): Promise<void> {
    const patterns = [
      join(this.TEMP_DIR, `${sessionId}.*`),
      join(this.TEMP_DIR, `${sessionId}.mp4`),
      join(this.TEMP_DIR, `${sessionId}.mp3`),
    ];

    for (const pattern of patterns) {
      try {
        // 直接删除特定文件
        await fs.unlink(pattern);
        console.log(`🗑️  已删除: ${pattern}`);
      } catch (error) {
        // 忽略文件不存在的错误
        if ((error as any).code !== 'ENOENT') {
          console.warn(`清理文件失败: ${pattern}`, error);
        }
      }
    }

    // 额外清理：查找所有匹配的文件
    try {
      const files = await fs.readdir(this.TEMP_DIR);
      const sessionFiles = files.filter((file) => file.startsWith(sessionId));
      
      for (const file of sessionFiles) {
        try {
          await fs.unlink(join(this.TEMP_DIR, file));
          console.log(`🗑️  已删除: ${file}`);
        } catch (error) {
          console.warn(`清理文件失败: ${file}`, error);
        }
      }
    } catch (error) {
      console.warn('清理目录扫描失败:', error);
    }
  }

  /**
   * 完整的视频处理流程：下载 + 提取音频
   */
  static async processVideo(videoUrl: string, sessionId: string): Promise<{
    videoPath: string;
    audioPath: string;
    metadata: VideoMetadata;
  }> {
    try {
      // 1. 获取和验证视频元数据
      const metadata = await this.getVideoMetadata(videoUrl);
      
      // 2. 下载视频
      const videoPath = await this.downloadVideo(videoUrl, sessionId);
      
      // 3. 提取音频
      const audioPath = await this.extractAudio(videoPath, sessionId);
      
      return { videoPath, audioPath, metadata };
      
    } catch (error) {
      // 确保在出错时清理文件
      await this.cleanup(sessionId);
      throw error;
    }
  }
}