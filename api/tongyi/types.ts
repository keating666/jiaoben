/**
 * Shared types for Tongyi API endpoints
 */

// Text Generation Types
export interface TextGenerationRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface TextGenerationResponse {
  success: boolean;
  data?: {
    content: string;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    model: string;
  };
  error?: string;
}

// Script Rewrite Types
export type ScriptStyle = 'humorous' | 'educational' | 'emotional' | 'professional';

export interface ScriptRewriteRequest {
  original_script: string;
  style: ScriptStyle;
  target_length?: number;
  additional_requirements?: string;
  stream?: boolean;
}

export interface ScriptRewriteResponse {
  success: boolean;
  data?: {
    rewritten_script: string;
    style_applied: string;
    character_count: number;
    changes_summary: string;
    processing_time: number;
  };
  error?: string;
}

// Streaming response format
export interface StreamingChunk {
  content: string;
  done: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
}