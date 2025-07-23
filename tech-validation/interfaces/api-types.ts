/**
 * AI服务通用接口定义
 */

// 基础API响应接口
export interface BaseApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  request_id?: string;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

// 服务配置接口
export interface ServiceConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
  retryDelayBase?: number;
  groupId?: string; // MiniMax specific
}

// 语音转文字请求接口
export interface SpeechToTextRequest {
  audioFile?: Buffer;
  audioUrl?: string;
  language?: string;
  format?: 'mp3' | 'wav' | 'flac' | 'm4a';
  sampleRate?: number;
}

// 语音转文字响应接口
export interface SpeechToTextResponse {
  text: string;
  confidence?: number;
  duration?: number;
  language?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    confidence?: number;
  }>;
}

// 文本生成请求接口
export interface TextGenerationRequest {
  prompt: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

// 文本生成响应接口
export interface TextGenerationResponse {
  text: string;
  finish_reason?: string;
  model?: string;
  created?: number;
}

// 错误类型定义
export interface ApiError extends Error {
  code?: string | number;
  status?: number;
  response?: any;
  retryable?: boolean;
}

// 性能监控接口
export interface PerformanceMetrics {
  requestId: string;
  service: string;
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

// AI服务客户端抽象接口
export interface AIServiceClient {
  name: string;
  initialize(config: ServiceConfig): Promise<void>;
  healthCheck(): Promise<boolean>;
  speechToText(request: SpeechToTextRequest): Promise<SpeechToTextResponse>;
  generateText?(request: TextGenerationRequest): Promise<TextGenerationResponse>;
}