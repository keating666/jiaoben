/**
 * Tongyi Script Rewrite API Endpoint
 * POST /api/tongyi/script-rewrite
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { TongyiClient } from '../../tech-validation/clients/tongyi-client';
import { 
  ScriptRewriteRequest, 
  ScriptRewriteResponse,
  ScriptStyle,
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
  stylePrompts,
  getCachedPrompt,
  setCachedPrompt,
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

function buildRewritePrompt(
  originalScript: string,
  style: ScriptStyle,
  targetLength?: number,
  additionalRequirements?: string
): string {
  const stylePrompt = stylePrompts[style];
  
  let prompt = `${stylePrompt}\n\n原始脚本：\n${originalScript}\n\n`;
  
  if (targetLength) {
    prompt += `目标长度：约${targetLength}字\n`;
  } else {
    prompt += `目标长度：与原始脚本相近\n`;
  }
  
  if (additionalRequirements) {
    prompt += `额外要求：${additionalRequirements}\n`;
  }
  
  prompt += '\n请提供改写后的脚本，并在最后简要说明主要改动。';
  
  return prompt;
}

function extractRewriteResult(generatedText: string): {
  script: string;
  summary: string;
} {
  // Try to extract script and summary from the generated text
  const parts = generatedText.split(/主要改动[:：]|改动说明[:：]/i);
  
  if (parts.length >= 2) {
    return {
      script: parts[0].trim(),
      summary: parts[1].trim()
    };
  }
  
  // If no clear separation, return the whole text as script
  return {
    script: generatedText.trim(),
    summary: '已根据要求完成脚本改写'
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ScriptRewriteResponse | string>
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
  if (!checkRateLimit(clientIp as string, 5, 60000)) { // Stricter limit for script rewriting
    return sendError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later');
  }
  
  try {
    // Parse and validate request body
    const body: ScriptRewriteRequest = req.body;
    
    if (!body.original_script) {
      return sendError(res, 400, 'INVALID_REQUEST', 'original_script is required');
    }
    
    if (!body.style) {
      return sendError(res, 400, 'INVALID_REQUEST', 'style is required');
    }
    
    // Validate script size (max 2000 characters)
    if (!validateRequestSize(body.original_script, 2000)) {
      return sendError(res, 400, 'CONTENT_TOO_LARGE', 'Original script exceeds 2000 characters');
    }
    
    // Validate style
    const validStyles: ScriptStyle[] = ['humorous', 'educational', 'emotional', 'professional'];
    if (!validStyles.includes(body.style)) {
      return sendError(res, 400, 'INVALID_STYLE', `Style must be one of: ${validStyles.join(', ')}`);
    }
    
    // Validate target length if provided
    if (body.target_length && (body.target_length < 50 || body.target_length > 3000)) {
      return sendError(res, 400, 'INVALID_LENGTH', 'Target length must be between 50 and 3000 characters');
    }
    
    // Get Tongyi client
    const client = await getTongyiClient();
    
    // Build the rewrite prompt
    const promptKey = `${body.style}-${body.original_script.substring(0, 50)}`;
    let prompt = getCachedPrompt(promptKey);
    
    if (!prompt) {
      prompt = buildRewritePrompt(
        body.original_script,
        body.style,
        body.target_length,
        body.additional_requirements
      );
      setCachedPrompt(promptKey, prompt);
    }
    
    // Handle streaming mode
    if (body.stream) {
      setupSSE(res);
      
      try {
        // Call Tongyi API with streaming
        const response = await client.generateText({
          prompt,
          model: 'qwen-max', // Use best model for script rewriting
          max_tokens: 2000,
          temperature: 0.8, // Higher temperature for creative rewriting
          stream: true
        });
        
        // Extract script and summary
        const result = extractRewriteResult(response.text);
        
        // Send streaming chunks
        const chunks = result.script.split(/[。！？]/).filter(s => s.trim());
        for (const chunk of chunks) {
          const streamChunk: StreamingChunk = {
            content: chunk + '。',
            done: false
          };
          sendSSEChunk(res, streamChunk);
          // Simulate streaming delay
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Send final chunk
        const finalChunk: StreamingChunk = {
          content: result.script,
          done: true
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
        // Call Tongyi API
        const response = await client.generateText({
          prompt,
          model: 'qwen-max',
          max_tokens: 2000,
          temperature: 0.8,
          stream: false
        });
        
        const processingTime = measurePerformance(startTime);
        
        // Check performance requirement (< 8s for script rewriting)
        if (processingTime > 8000) {
          console.warn(`Script rewriting took ${processingTime}ms, exceeding 8s target`);
        }
        
        // Extract script and summary
        const result = extractRewriteResult(response.text);
        
        sendSuccess(res, {
          rewritten_script: result.script,
          style_applied: body.style,
          character_count: result.script.length,
          changes_summary: result.summary,
          processing_time: processingTime
        });
        
      } catch (error: any) {
        console.error('Tongyi API error:', error);
        
        // Handle specific error types with exponential backoff hint
        if (error.response?.status === 429) {
          return sendError(res, 429, 'RATE_LIMIT', 'Tongyi API rate limit exceeded', {
            retryAfter: error.response.headers['retry-after'],
            suggestion: 'Implement exponential backoff with initial delay of 1s'
          });
        }
        
        if (error.response?.status === 503) {
          // Automatic retry with fallback
          console.log('Service overload, attempting retry...');
          try {
            // Wait 2 seconds and retry once
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const retryResponse = await client.generateText({
              prompt,
              model: 'qwen-plus', // Fallback to lighter model
              max_tokens: 1500,
              temperature: 0.7,
              stream: false
            });
            
            const result = extractRewriteResult(retryResponse.text);
            const processingTime = measurePerformance(startTime);
            
            return sendSuccess(res, {
              rewritten_script: result.script,
              style_applied: body.style,
              character_count: result.script.length,
              changes_summary: result.summary + ' (使用备用模型)',
              processing_time: processingTime
            });
            
          } catch (retryError) {
            return sendError(res, 503, 'SERVICE_OVERLOAD', 'Tongyi service is currently overloaded');
          }
        }
        
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
          return sendError(res, 504, 'TIMEOUT', 'Request to Tongyi API timed out (30s limit)');
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
      sizeLimit: '100kb'
    },
    responseLimit: false, // Disable response size limit for streaming
    maxDuration: 30 // 30 seconds timeout for script rewriting
  }
};