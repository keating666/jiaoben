import path from 'path';
import fs from 'fs/promises';

import youtubeDl from 'youtube-dl-exec';

import { logger } from './logger';
import { DouyinLinkExtractor, DouyinVideoInfo } from './douyin-link-extractor';

export interface DouyinDownloadOptions {
  outputDir?: string;
  format?: string;
  quality?: 'best' | 'worst' | string;
  extractAudio?: boolean;
  cookies?: string;
}

export interface DouyinDownloadResult {
  success: boolean;
  videoInfo?: DouyinVideoInfo;
  filePath?: string;
  error?: string;
}

export class DouyinDownloader {
  private defaultOptions: DouyinDownloadOptions = {
    outputDir: './downloads',
    format: 'mp4',
    quality: 'best',
    extractAudio: false,
  };

  constructor(private options: DouyinDownloadOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * 获取抖音视频信息
   */
  async getVideoInfo(url: string): Promise<DouyinVideoInfo | null> {
    try {
      logger.info('DouyinDownloader', 'getVideoInfo', '获取视频信息', { url });
      
      // 规范化URL
      const normalizedUrl = DouyinLinkExtractor.normalizeUrl(url);
      
      // 如果是短链接，先解析
      let finalUrl = normalizedUrl;

      if (normalizedUrl.includes('v.douyin.com')) {
        const resolvedUrl = await DouyinLinkExtractor.resolveShortLink(normalizedUrl);

        if (resolvedUrl) {
          finalUrl = resolvedUrl;
        }
      }

      // 使用 youtube-dl 获取视频信息
      const info = await youtubeDl(finalUrl, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
          'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ],
      }) as any; // 类型断言以处理类型问题

      const videoId = DouyinLinkExtractor.extractVideoId(finalUrl) || info.id;
      
      return {
        videoId: videoId || 'unknown',
        title: info.title || undefined,
        author: info.uploader || undefined,
        downloadUrl: info.url || undefined,
        coverUrl: info.thumbnail || undefined,
        duration: info.duration || undefined,
      };
    } catch (error) {
      logger.error('DouyinDownloader', 'getVideoInfo', '获取视频信息失败', error as Error);

      return null;
    }
  }

  /**
   * 下载抖音视频
   */
  async downloadVideo(url: string): Promise<DouyinDownloadResult> {
    try {
      logger.info('DouyinDownloader', 'downloadVideo', '开始下载视频', { url });
      
      // 确保输出目录存在
      const outputDir = this.options.outputDir || './downloads';

      await fs.mkdir(outputDir, { recursive: true });

      // 获取视频信息
      const videoInfo = await this.getVideoInfo(url);

      if (!videoInfo) {
        return {
          success: false,
          error: '无法获取视频信息',
        };
      }

      // 生成输出文件名
      const timestamp = new Date().getTime();
      const safeTitle = (videoInfo.title || 'video')
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')
        .substring(0, 50);
      const fileName = `${safeTitle}_${timestamp}.${this.options.format}`;
      const outputPath = path.join(outputDir, fileName);

      // 下载选项
      const downloadOptions: any = {
        output: outputPath,
        format: this.options.quality === 'best' ? 'best[ext=mp4]/best' : 'worst',
        noCheckCertificates: true,
        noWarnings: true,
        addHeader: [
          'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ],
      };

      // 如果需要提取音频
      if (this.options.extractAudio) {
        downloadOptions.extractAudio = true;
        downloadOptions.audioFormat = 'mp3';
        downloadOptions.audioQuality = 0;
      }

      // 如果提供了 cookies
      if (this.options.cookies) {
        downloadOptions.cookies = this.options.cookies;
      }

      // 执行下载
      await youtubeDl(url, downloadOptions);

      logger.info('DouyinDownloader', 'downloadVideo', '视频下载成功', { 
        outputPath,
        videoInfo, 
      });

      return {
        success: true,
        videoInfo,
        filePath: outputPath,
      };
    } catch (error) {
      logger.error('DouyinDownloader', 'downloadVideo', '视频下载失败', error as Error);

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 批量下载视频
   */
  async downloadBatch(urls: string[]): Promise<DouyinDownloadResult[]> {
    logger.info('DouyinDownloader', 'downloadBatch', '开始批量下载', { 
      count: urls.length, 
    });

    const results: DouyinDownloadResult[] = [];
    
    for (const url of urls) {
      const result = await this.downloadVideo(url);

      results.push(result);
      
      // 避免请求过快
      await this.delay(2000);
    }

    const successCount = results.filter((r) => r.success).length;

    logger.info('DouyinDownloader', 'downloadBatch', '批量下载完成', { 
      total: urls.length,
      success: successCount,
      failed: urls.length - successCount,
    });

    return results;
  }

  /**
   * 提取视频音频
   */
  async extractAudio(videoUrl: string): Promise<DouyinDownloadResult> {
    const audioOptions = { ...this.options, extractAudio: true };
    const downloader = new DouyinDownloader(audioOptions);

    return downloader.downloadVideo(videoUrl);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 清理下载目录
   */
  async cleanDownloadDir(): Promise<void> {
    try {
      const outputDir = this.options.outputDir || './downloads';
      const files = await fs.readdir(outputDir);
      
      for (const file of files) {
        const filePath = path.join(outputDir, file);

        await fs.unlink(filePath);
      }
      
      logger.info('DouyinDownloader', 'cleanDownloadDir', '清理下载目录完成', { 
        filesDeleted: files.length, 
      });
    } catch (error) {
      logger.error('DouyinDownloader', 'cleanDownloadDir', '清理下载目录失败', error as Error);
    }
  }
}