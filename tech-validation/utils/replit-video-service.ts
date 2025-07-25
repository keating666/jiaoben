/**
 * Replit 视频处理服务客户端
 * 调用 Replit 上的微服务处理视频下载和音频提取
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ReplitServiceConfig {
  baseUrl: string;  // Replit 服务 URL
  timeout?: number;
}

export interface VideoInfo {
  title: string;
  duration: number;
  uploader: string;
  description: string;
  thumbnail: string;
  url: string;
}

export class ReplitVideoService {
  private config: ReplitServiceConfig;
  
  constructor(config?: Partial<ReplitServiceConfig>) {
    this.config = {
      baseUrl: process.env.REPLIT_VIDEO_SERVICE_URL || 'https://your-repl-name.repl.co',
      timeout: 120000, // 2 分钟超时
      ...config
    };
  }
  
  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      
      const data = await response.json();
      return (data.status === 'healthy' || data.status === 'ok') && (data.ffmpeg_available || data.ffmpeg);
    } catch (error) {
      console.error('Replit 服务健康检查失败:', error);
      return false;
    }
  }
  
  /**
   * 获取视频信息
   */
  async getVideoInfo(videoUrl: string): Promise<VideoInfo> {
    const response = await fetch(`${this.config.baseUrl}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ video_url: videoUrl }),
      signal: AbortSignal.timeout(30000)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '获取视频信息失败');
    }
    
    return await response.json();
  }
  
  /**
   * 处理视频并下载音频
   */
  async processVideo(videoUrl: string): Promise<{
    audioPath: string;
    metadata: {
      duration: number;
      title: string;
      sessionId: string;
    };
  }> {
    console.log(`🎥 调用 Replit 服务处理视频: ${videoUrl}`);
    
    const response = await fetch(`${this.config.baseUrl}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ video_url: videoUrl }),
      signal: AbortSignal.timeout(this.config.timeout!)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '视频处理失败');
    }
    
    // 从响应头获取元数据
    const duration = parseInt(response.headers.get('X-Video-Duration') || '0');
    const title = response.headers.get('X-Video-Title') || 'Unknown';
    const sessionId = response.headers.get('X-Session-Id') || uuidv4();
    
    // 保存音频文件到本地
    const audioBuffer = await response.arrayBuffer();
    const audioPath = join('/tmp', `audio_${sessionId}.mp3`);
    await fs.writeFile(audioPath, Buffer.from(audioBuffer));
    
    console.log(`✅ 音频下载完成: ${audioPath} (${(audioBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
    
    return {
      audioPath,
      metadata: {
        duration,
        title,
        sessionId
      }
    };
  }
}

/**
 * 创建默认实例
 */
export function createReplitVideoService(): ReplitVideoService {
  return new ReplitVideoService();
}