/**
 * Tongyi Text Generation API Endpoint
 * POST /api/tongyi/text-generation
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { TongyiClient } from '../../tech-validation/clients/tongyi-client';
import { 
  TextGenerationRequest, 
  TextGenerationResponse,
  StreamingChunk 
} from './types';
import {
  validateApiKey,
  validateRequestSize,
  sendError,
  sendSuccess,
  setCorsHeaders,
  checkRateLimit,
  measurePerformance,
  setupSSE,
  sendSSEChunk,
  closeSSE
} from './utils';

// Initialize Tongyi client with singleton pattern and error handling
let tongyiClient: TongyiClient | null = null;
let clientInitPromise: Promise<TongyiClient> | null = null;

async function getTongyiClient(): Promise<TongyiClient> {
  // Return existing client if available
  if (tongyiClient) {
    return tongyiClient;
  }
  
  // Prevent multiple simultaneous initialization attempts
  if (clientInitPromise) {
    return clientInitPromise;
  }
  
  clientInitPromise = (async () => {
    try {
      const client = new TongyiClient();
      await client.initialize({
        apiKey: process.env.TONGYI_API_KEY || '',
        baseUrl: process.env.TONGYI_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
        timeout: 30000
      });
      tongyiClient = client;
      return client;
    } catch (error) {
      clientInitPromise = null; // Reset on error to allow retry
      throw error;
    }
  })();
  
  return clientInitPromise;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TextGenerationResponse | string>
) {
  const startTime = Date.now();
  
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Only POST method is allowed');
  }
  
  // Validate API key
  if (!validateApiKey(req)) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid or missing API key');
  }
  
  // Rate limiting
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp as string)) {
    return sendError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later');
  }
  
  try {
    // Parse and validate request body
    const body: TextGenerationRequest = req.body;
    
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return sendError(res, 400, 'INVALID_REQUEST', 'Messages array is required and must not be empty');
    }
    
    // Validate message content size
    const totalContent = body.messages.map(m => m.content).join('');
    if (!validateRequestSize(totalContent)) {
      return sendError(res, 400, 'CONTENT_TOO_LARGE', 'Total message content exceeds 4000 characters');
    }
    
    // Validate message structure
    for (const message of body.messages) {
      if (!message.role || !message.content) {
        return sendError(res, 400, 'INVALID_MESSAGE', 'Each message must have role and content');
      }
      if (!['system', 'user', 'assistant'].includes(message.role)) {
        return sendError(res, 400, 'INVALID_ROLE', 'Message role must be system, user, or assistant');
      }
    }
    
    // Get Tongyi client
    const client = await getTongyiClient();
    
    // Handle streaming mode
    if (body.stream) {
      setupSSE(res);
      
      try {
        // Create prompt from messages
        const prompt = body.messages
          .map(m => `${m.role}: ${m.content}`)
          .join('\n');
        
        // Call Tongyi API with streaming
        const response = await client.generateText({
          prompt,
          model: body.model || 'qwen-max',
          max_tokens: body.max_tokens || 1500,
          temperature: body.temperature || 0.7,
          stream: true
        });
        
        // For now, we'll send the complete response as a single chunk
        // In a real implementation, you'd handle actual streaming from Tongyi
        const chunk: StreamingChunk = {
          content: response.text,
          done: false
        };
        sendSSEChunk(res, chunk);
        
        // Send final chunk with usage data
        const finalChunk: StreamingChunk = {
          content: response.text,
          done: true,
          usage: {
            prompt_tokens: Math.floor(prompt.length / 4), // Rough estimate
            completion_tokens: Math.floor(response.text.length / 4),
            total_tokens: Math.floor((prompt.length + response.text.length) / 4)
          }
        };
        sendSSEChunk(res, finalChunk);
        closeSSE(res);
        
      } catch (error: any) {
        sendSSEChunk(res, { error: error.message, done: true });
        closeSSE(res);
      }
      
    } else {
      // Non-streaming mode
      try {
        // Create prompt from messages
        const prompt = body.messages
          .map(m => `${m.role}: ${m.content}`)
          .join('\n');
        
        // Call Tongyi API
        const response = await client.generateText({
          prompt,
          model: body.model || 'qwen-max',
          max_tokens: body.max_tokens || 1500,
          temperature: body.temperature || 0.7,
          stream: false
        });
        
        const processingTime = measurePerformance(startTime);
        
        // Check performance requirement
        if (processingTime > 3000) {
          console.warn(`Text generation took ${processingTime}ms, exceeding 3s target`);
        }
        
        sendSuccess(res, {
          content: response.text,
          usage: {
            prompt_tokens: Math.floor(prompt.length / 4), // Rough estimate
            completion_tokens: Math.floor(response.text.length / 4),
            total_tokens: Math.floor((prompt.length + response.text.length) / 4)
          },
          model: response.model || body.model || 'qwen-max'
        });
        
      } catch (error: any) {
        console.error('Tongyi API error:', error);
        
        // Handle specific error types
        if (error.response?.status === 429) {
          return sendError(res, 429, 'RATE_LIMIT', 'Tongyi API rate limit exceeded', {
            retryAfter: error.response.headers['retry-after']
          });
        }
        
        if (error.response?.status === 503) {
          return sendError(res, 503, 'SERVICE_OVERLOAD', 'Tongyi service is currently overloaded');
        }
        
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          return sendError(res, 504, 'TIMEOUT', 'Request to Tongyi API timed out');
        }
        
        return sendError(res, 500, 'INTERNAL_ERROR', error.message || 'An unexpected error occurred');
      }
    }
    
  } catch (error: any) {
    console.error('Handler error:', error);
    return sendError(res, 500, 'INTERNAL_ERROR', error.message || 'An unexpected error occurred');
  }
}

// Export config for Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    },
    responseLimit: false // Disable response size limit for streaming
  }
};