import { EnhancedApiClient } from '../utils/api-client';
import { logger } from '../utils/logger';
import { SecurityValidator } from '../utils/security-validator';
import { 
  ServiceError, 
  ServiceUnavailableError, 
  VideoNotFoundError,
  ApiKeyInvalidError,
  RateLimitError,
  ValidationError,
  NetworkError
} from '../utils/error-types';

/**
 * TikHub API 配置
 */
interface TikHubConfig {
  apiToken: string;
  baseUrl?: string;
  preferGuestMode?: boolean; // 优先使用游客模式
}

/**
 * 视频解析请求
 */
interface VideoResolveRequest {
  url: string;           // 抖音分享链接
  needAuth?: boolean;    // 是否需要登录（默认false）
  quality?: 'lowest' | 'medium' | 'highest'; // 质量偏好
}

/**
 * 视频解析响应
 */
interface VideoResolveResponse {
  videoId: string;       // 视频ID
  videoUrl: string;      // 真实视频地址（优选）
  videoUrls: string[];   // 所有可用地址
  metadata?: {
    title?: string;
    author?: string;
    duration?: number;
    createTime?: string;
  };
}

/**
 * TikHub 客户端
 * 专注于抖音视频地址解析
 */
export class TikHubClient {
  private readonly client: EnhancedApiClient;
  private readonly config: Required<TikHubConfig>;
  private readonly validator: SecurityValidator;

  constructor(config: TikHubConfig) {
    this.config = {
      apiToken: config.apiToken,
      baseUrl: config.baseUrl || 'https://api.tikhub.io',
      preferGuestMode: config.preferGuestMode ?? true // 默认游客模式
    };

    this.validator = new SecurityValidator({
      allowedDomains: ['douyin.com', 'iesdouyin.com', 'douyinvod.com'],
      enableUrlValidation: true
    });

    this.client = new EnhancedApiClient(
      'TikHubClient',
      {
        timeout: 15000,
        maxRetries: 3,
        retryDelay: 1000
      }
    );
  }

  /**
   * 解析抖音视频地址（主要方法）
   */
  async resolveVideo(request: VideoResolveRequest): Promise<VideoResolveResponse> {
    logger.info('TikHubClient', 'resolveVideo', '开始解析视频', {
      url: request.url.substring(0, 50) + '...'
    });

    try {
      // 1. 验证输入URL
      SecurityValidator.validateVideoUrl(request.url);

      // 2. 提取视频ID
      const videoId = this.extractVideoId(request.url);
      if (!videoId) {
        throw new ValidationError('无法从URL中提取视频ID', 'url', request.url);
      }

      // 3. 根据配置选择API
      const useGuestMode = request.needAuth === false || this.config.preferGuestMode;
      
      if (useGuestMode) {
        return await this.resolveViaWebApi(videoId, request);
      } else {
        return await this.resolveViaAppApi(videoId, request);
      }

    } catch (error) {
      logger.error('TikHubClient', 'resolveVideo', '解析失败', error as Error);
      throw this.handleError(error);
    }
  }

  /**
   * 通过 Web API 解析（游客模式）
   */
  private async resolveViaWebApi(
    videoId: string, 
    request: VideoResolveRequest
  ): Promise<VideoResolveResponse> {
    logger.info('TikHubClient', 'resolveViaWebApi', '使用Web API解析');

    const response = await this.client.get<any>(
      `${this.config.baseUrl}/api/v1/douyin/web/fetch_one_video`,
      {
        params: {
          aweme_id: videoId
        },
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return this.parseWebApiResponse(response.data, videoId);
  }

  /**
   * 通过 App API 解析（可能需要更多权限）
   */
  private async resolveViaAppApi(
    videoId: string,
    request: VideoResolveRequest
  ): Promise<VideoResolveResponse> {
    logger.info('TikHubClient', 'resolveViaAppApi', '使用App API解析');

    const response = await this.client.post<any>(
      `${this.config.baseUrl}/api/v1/douyin/app/v3/fetch_one_video`,
      {
        aweme_id: videoId,
        version_code: '34.1.0',
        device_platform: 'android'
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return this.parseAppApiResponse(response.data, videoId);
  }

  /**
   * 提取视频ID
   */
  private extractVideoId(url: string): string | null {
    // 处理短链接
    const shortLinkMatch = url.match(/v\.douyin\.com\/([a-zA-Z0-9]+)/);
    if (shortLinkMatch) {
      return shortLinkMatch[1];
    }

    // 处理长链接
    const longLinkMatch = url.match(/video\/(\d+)/);
    if (longLinkMatch) {
      return longLinkMatch[1];
    }

    // 处理其他格式
    const patterns = [
      /aweme_id=(\d+)/,
      /\/([\d]{19})/,
      /modal_id=(\d+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 解析 Web API 响应
   */
  private parseWebApiResponse(data: any, videoId: string): VideoResolveResponse {
    const video = data.aweme_detail || data.item || data;
    
    // 提取视频URLs
    const urlList = video.video?.play_addr?.url_list || [];
    const urls = this.selectBestUrls(urlList);

    if (urls.length === 0) {
      throw new ServiceError('TikHub', '未找到可用的视频地址', 404, false);
    }

    return {
      videoId,
      videoUrl: urls[0],
      videoUrls: urls,
      metadata: {
        title: video.desc || video.share_info?.share_title,
        author: video.author?.nickname,
        duration: video.video?.duration,
        createTime: video.create_time ? new Date(video.create_time * 1000).toISOString() : undefined
      }
    };
  }

  /**
   * 解析 App API 响应
   */
  private parseAppApiResponse(data: any, videoId: string): VideoResolveResponse {
    const video = data.aweme_list?.[0] || data.aweme_detail || data;
    
    // App API 可能返回更多格式选项
    const playAddr = video.video?.play_addr || {};
    const urlList = playAddr.url_list || [];
    const urls = this.selectBestUrls(urlList);

    if (urls.length === 0) {
      throw new ServiceError('TikHub', '未找到可用的视频地址', 404, false);
    }

    return {
      videoId,
      videoUrl: urls[0],
      videoUrls: urls,
      metadata: {
        title: video.desc,
        author: video.author?.nickname,
        duration: video.duration,
        createTime: video.create_time ? new Date(video.create_time * 1000).toISOString() : undefined
      }
    };
  }

  /**
   * 选择最佳的视频URLs
   */
  private selectBestUrls(urlList: string[]): string[] {
    if (!Array.isArray(urlList) || urlList.length === 0) {
      return [];
    }

    // 过滤和排序URLs
    const validUrls = urlList
      .filter(url => {
        // 过滤无效URL
        if (!url || typeof url !== 'string') return false;
        if (!url.startsWith('http')) return false;
        
        // 验证域名
        try {
          const urlObj = new URL(url);
          const allowedDomains = ['douyinvod.com', 'douyincdn.com', 'snssdk.com'];
          return allowedDomains.some(domain => urlObj.hostname.includes(domain));
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        // 优先选择特定CDN
        const preferredCDN = ['v26', 'v3', 'v9'];
        const aScore = preferredCDN.findIndex(cdn => a.includes(cdn));
        const bScore = preferredCDN.findIndex(cdn => b.includes(cdn));
        
        if (aScore !== -1 && bScore !== -1) {
          return aScore - bScore;
        }
        if (aScore !== -1) return -1;
        if (bScore !== -1) return 1;
        
        return 0;
      });

    // 去重
    return [...new Set(validUrls)];
  }

  /**
   * 批量解析视频
   */
  async resolveVideoBatch(urls: string[]): Promise<VideoResolveResponse[]> {
    logger.info('TikHubClient', 'resolveVideoBatch', `批量解析 ${urls.length} 个视频`);

    const results = await Promise.allSettled(
      urls.map(url => this.resolveVideo({ url }))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.warn('TikHubClient', 'resolveVideoBatch', `视频 ${index} 解析失败`, {
          url: urls[index],
          error: result.reason
        });
        throw result.reason;
      }
    });
  }

  /**
   * 错误处理
   */
  private handleError(error: any): Error {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          return new ApiKeyInvalidError('TikHub');
        case 403:
          return new ServiceError('TikHub', 'API 配额不足或权限受限', 403, false);
        case 404:
          return new VideoNotFoundError(this.extractVideoId(error.config?.params?.aweme_id || '') || 'unknown', 'douyin');
        case 429:
          const retryAfter = error.response.headers['retry-after'];
          return new RateLimitError('TikHub', retryAfter ? parseInt(retryAfter) : undefined);
        default:
          return new ServiceError('TikHub', `API错误: ${data?.message || error.message}`, status, status >= 500);
      }
    }

    // 网络错误
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return new NetworkError('无法连接到TikHub服务', { code: error.code }, error);
    }
    
    return error instanceof Error ? error : new ServiceError('TikHub', '解析视频失败', undefined, true);
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get(
        `${this.config.baseUrl}/`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`
          }
        }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.client.dispose();
  }
}