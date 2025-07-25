/**
 * Railway 视频处理服务客户端
 */

import { logger } from './logger';

export interface VideoInfo {
  title: string;
  duration: number;
  uploader: string;
  view_count: number;
  like_count: number;
  description: string;
}

export interface ProcessVideoResponse {
  success: boolean;
  video_info?: VideoInfo;
  audio?: {
    size: number;
    format: string;
    data: string; // hex string
  };
  error?: string;
}

export class RailwayVideoService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = process.env.RAILWAY_VIDEO_SERVICE_URL || '';
    this.timeout = 60000; // 60秒超时
  }

  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<boolean> {
    if (!this.baseUrl) {
      logger.warn('RailwayVideoService', 'checkHealth', 'RAILWAY_VIDEO_SERVICE_URL 未配置');
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.status === 'healthy' && data.ffmpeg_available;
    } catch (error) {
      logger.error('RailwayVideoService', 'checkHealth', '健康检查失败', error as Error);
      return false;
    }
  }

  /**
   * 处理视频：下载并提取音频
   */
  async processVideo(url: string): Promise<ProcessVideoResponse> {
    if (!this.baseUrl) {
      throw new Error('RAILWAY_VIDEO_SERVICE_URL 未配置');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      logger.info('RailwayVideoService', 'processVideo', '开始处理视频', { url });

      const response = await fetch(`${this.baseUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: ProcessVideoResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '视频处理失败');
      }

      logger.info('RailwayVideoService', 'processVideo', '视频处理成功', {
        title: data.video_info?.title,
        duration: data.video_info?.duration,
        audioSize: data.audio?.size,
      });

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('视频处理超时');
        }
        throw error;
      }
      
      throw new Error('视频处理失败');
    }
  }

  /**
   * 将十六进制音频数据转换为 Buffer
   */
  static hexToBuffer(hexString: string): Buffer {
    return Buffer.from(hexString, 'hex');
  }

  /**
   * 将音频数据保存到临时文件
   */
  static async saveAudioToFile(hexData: string, filePath: string): Promise<void> {
    const fs = await import('fs/promises');
    const buffer = this.hexToBuffer(hexData);
    await fs.writeFile(filePath, buffer);
  }
}