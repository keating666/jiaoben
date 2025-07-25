/**
 * Vercel 环境模拟助手
 * 仅在视频下载失败时提供备用方案
 */

import { createMockAudioFile, MOCK_TRANSCRIPT } from './mock-audio';
import { TranscriptionResult } from './audio-transcriber';

export interface MockVideoInfo {
  videoUrl: string;
  title: string;
  duration: number;
  isMocked: boolean;
}

/**
 * 检查是否应该使用模拟模式
 * 仅在 Vercel 环境且是演示/测试时使用
 */
export function shouldUseMockMode(): boolean {
  // 检查是否在 Vercel 环境
  if (!process.env.VERCEL) {
    return false;
  }
  
  // 检查是否允许模拟模式（可通过环境变量控制）
  if (process.env.DISABLE_MOCK_MODE === 'true') {
    return false;
  }
  
  return true;
}

/**
 * 创建模拟的视频元数据
 */
export function createMockVideoMetadata(videoUrl: string): MockVideoInfo {
  return {
    videoUrl,
    title: '抖音测试视频（模拟数据）',
    duration: 30,
    isMocked: true,
  };
}

/**
 * 创建模拟的转写结果
 * 用于视频下载失败时的备用方案
 */
export function createMockTranscriptionResult(): TranscriptionResult {
  return {
    text: MOCK_TRANSCRIPT,
    confidence: 0.95,
    duration: 30,
    segments: [
      {
        start: 0,
        end: 8,
        text: '大家好，欢迎来到我的抖音视频。',
        confidence: 0.96,
      },
      {
        start: 8,
        end: 16,
        text: '今天我要跟大家分享一个非常有趣的内容。',
        confidence: 0.94,
      },
      {
        start: 16,
        end: 24,
        text: '这是一个测试视频，用于演示视频转文字的功能。',
        confidence: 0.95,
      },
      {
        start: 24,
        end: 30,
        text: '希望大家喜欢这个视频，记得点赞关注哦！',
        confidence: 0.93,
      },
    ],
    processingTime: 100,
  };
}

/**
 * 日志辅助函数
 */
export function logMockUsage(stage: string, reason: string): void {
  console.log(`⚠️  [Mock Mode] ${stage}: ${reason}`);
  console.log('💡 提示：这是由于 Vercel 环境限制使用的模拟数据');
  console.log('📌 注意：API 调用（MiniMax/Tongyi）仍使用真实服务');
}