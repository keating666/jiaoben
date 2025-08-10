/**
 * Shared utilities for Tongyi API endpoints
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { ScriptStyle } from './types';

// API Key validation with constant-time comparison to prevent timing attacks
export function validateApiKey(req: NextApiRequest): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const apiKey = authHeader.substring(7);
  const validApiKey = process.env.API_AUTH_KEY || 'default-key';
  
  // Use constant-time comparison to prevent timing attacks
  if (apiKey.length !== validApiKey.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < apiKey.length; i++) {
    result |= apiKey.charCodeAt(i) ^ validApiKey.charCodeAt(i);
  }
  
  return result === 0;
}

// Request size validation
export function validateRequestSize(content: string, maxSize: number = 4000): boolean {
  return content.length <= maxSize;
}

// Style prompts for script rewriting
export const stylePrompts: Record<ScriptStyle, string> = {
  humorous: "请将这段短视频脚本改写成幽默风趣的风格，加入适当的网络流行语和段子，保持内容核心不变但让人会心一笑。注意保持时长和节奏。",
  educational: "请将这段脚本改写成教育科普风格，确保信息准确、逻辑清晰，用通俗易懂的语言解释复杂概念，适合学习和传播知识。",
  emotional: "请将这段脚本改写成情感丰富的风格，增加感人元素和情感共鸣点，让观众产生情感连接，但避免过度煽情。",
  professional: "请将这段脚本改写成专业正式的风格，使用行业术语和规范表达，体现专业性和权威性，适合商业或正式场合。"
};

// Error response helper
export function sendError(
  res: NextApiResponse,
  statusCode: number,
  code: string,
  message: string,
  details?: any
) {
  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    details
  });
}

// Success response helper
export function sendSuccess(res: NextApiResponse, data: any) {
  res.status(200).json({
    success: true,
    data
  });
}

// CORS headers helper
export function setCorsHeaders(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Rate limiting cache with automatic cleanup
const requestCounts = new Map<string, { count: number; resetTime: number }>();
let cleanupTimer: NodeJS.Timeout | null = null;

// Cleanup expired entries periodically
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }
}

// Start cleanup timer if not already running
function ensureCleanupTimer() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupExpiredEntries, 60000); // Clean every minute
    // Ensure cleanup timer doesn't prevent process from exiting
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }
}

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean {
  ensureCleanupTimer();
  
  const now = Date.now();
  const record = requestCounts.get(identifier);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// Performance monitoring helper
export function measurePerformance(startTime: number): number {
  return Date.now() - startTime;
}

// Prompt template cache
const promptCache = new Map<string, string>();

export function getCachedPrompt(key: string): string | undefined {
  return promptCache.get(key);
}

export function setCachedPrompt(key: string, prompt: string): void {
  // Limit cache size to prevent memory issues
  if (promptCache.size > 100) {
    const firstKey = promptCache.keys().next().value;
    if (firstKey) promptCache.delete(firstKey);
  }
  promptCache.set(key, prompt);
}

// Stream response helper for Server-Sent Events
export function setupSSE(res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

export function sendSSEChunk(res: NextApiResponse, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function closeSSE(res: NextApiResponse) {
  res.write('data: [DONE]\n\n');
  res.end();
}