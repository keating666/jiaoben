/**
 * 系统限制常量
 * 集中管理所有的限制值，避免魔法数字
 */

export const LIMITS = {
  // 视频相关限制
  VIDEO_DURATION_SECONDS: 60,
  VIDEO_FILE_SIZE_MB: 100,
  VIDEO_URL_MAX_LENGTH: 2048,
  
  // 音频相关限制
  AUDIO_FILE_SIZE_MB: 10,
  AUDIO_SAMPLE_RATE: 16000,
  
  // 处理超时限制
  PROCESSING_TIMEOUT_MS: 60000,      // Vercel Function 限制
  WARNING_TIMEOUT_MS: 50000,         // 50秒警告
  DOWNLOAD_TIMEOUT_MS: 30000,        // 视频下载超时
  METADATA_TIMEOUT_MS: 10000,        // 元数据获取超时
  
  // 并发和重试限制
  MAX_CONCURRENT_REQUESTS: 3,
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BASE_DELAY_MS: 1000,
  
  // API相关限制
  API_TOKEN_MIN_LENGTH: 32,
  API_REQUEST_MAX_SIZE_MB: 5,        // Vercel 默认限制
  API_RATE_LIMIT_PER_MINUTE: 100,
  
  // 文本和脚本限制
  TRANSCRIPTION_MIN_CONFIDENCE: 0.5,
  SCRIPT_MAX_SCENES: 10,
  SCRIPT_SCENE_DESCRIPTION_MAX_LENGTH: 500,
  SCRIPT_DIALOGUE_MAX_LENGTH: 1000,
  
  // 日志和调试限制
  LOG_MESSAGE_MAX_LENGTH: 200,
  ERROR_STACK_MAX_LINES: 10,
  
  // 缓存限制
  CACHE_TTL_SECONDS: 900,            // 15分钟缓存
  CACHE_MAX_ENTRIES: 100,
  
  // 二进制文件限制
  BINARY_MAX_BUFFER_SIZE: 10 * 1024 * 1024, // 10MB
  
  // 性能阈值（用于告警）
  PERFORMANCE_WARNING_THRESHOLDS: {
    video_processing: 10000,         // 10秒
    audio_transcription: 8000,       // 8秒
    script_generation: 5000,         // 5秒
    total_processing: 45000          // 45秒
  }
} as const;

// 导出类型
export type Limits = typeof LIMITS;
export type PerformanceThresholds = typeof LIMITS.PERFORMANCE_WARNING_THRESHOLDS;