/**
 * Integration tests for Tongyi API endpoints
 */

import { createMocks, RequestMethod } from 'node-mocks-http';
import textGenerationHandler from '../text-generation';
import scriptRewriteHandler from '../script-rewrite';

// Mock the TongyiClient
jest.mock('../../../tech-validation/clients/tongyi-client', () => ({
  TongyiClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    generateText: jest.fn().mockImplementation((request) => {
      // Simulate different responses based on input
      if (request.prompt.includes('error')) {
        throw new Error('Simulated API error');
      }
      if (request.prompt.includes('timeout')) {
        const error: any = new Error('Request timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return Promise.resolve({
        text: `Generated response for: ${request.prompt.substring(0, 50)}...`,
        model: request.model || 'qwen-max',
        finish_reason: 'stop',
        created: Date.now()
      });
    })
  }))
}));

describe('Tongyi API Endpoints Integration Tests', () => {
  const validApiKey = 'default-key';
  
  beforeEach(() => {
    // Set environment variables
    process.env.API_AUTH_KEY = validApiKey;
    process.env.TONGYI_API_KEY = 'test-tongyi-key';
    process.env.TONGYI_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
  });

  describe('POST /api/tongyi/text-generation', () => {
    it('should generate text successfully with valid request', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`,
          'Content-Type': 'application/json'
        },
        body: {
          messages: [
            { role: 'user', content: 'Hello, how are you?' }
          ],
          max_tokens: 100,
          temperature: 0.7
        }
      });

      await textGenerationHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.content).toContain('Generated response');
    });

    it('should reject request without API key', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          messages: [{ role: 'user', content: 'Test' }]
        }
      });

      await textGenerationHandler(req, res);

      expect(res._getStatusCode()).toBe(401);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid or missing API key');
    });

    it('should validate message structure', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          messages: [
            { role: 'invalid', content: 'Test' }
          ]
        }
      });

      await textGenerationHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.code).toBe('INVALID_ROLE');
    });

    it('should handle content size limits', async () => {
      const largeContent = 'a'.repeat(4001);
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          messages: [
            { role: 'user', content: largeContent }
          ]
        }
      });

      await textGenerationHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.code).toBe('CONTENT_TOO_LARGE');
    });

    it('should handle API errors gracefully', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          messages: [
            { role: 'user', content: 'trigger error' }
          ]
        }
      });

      await textGenerationHandler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(false);
      expect(data.error).toContain('Simulated API error');
    });

    it('should handle timeout errors', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          messages: [
            { role: 'user', content: 'trigger timeout' }
          ]
        }
      });

      await textGenerationHandler(req, res);

      expect(res._getStatusCode()).toBe(504);
      const data = JSON.parse(res._getData());
      expect(data.code).toBe('TIMEOUT');
    });
  });

  describe('POST /api/tongyi/script-rewrite', () => {
    it('should rewrite script successfully', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          original_script: 'This is a test script for rewriting.',
          style: 'humorous'
        }
      });

      await scriptRewriteHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.rewritten_script).toBeDefined();
      expect(data.data.style_applied).toBe('humorous');
      expect(data.data.character_count).toBeGreaterThan(0);
    });

    it('should validate script style', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          original_script: 'Test script',
          style: 'invalid_style'
        }
      });

      await scriptRewriteHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.code).toBe('INVALID_STYLE');
    });

    it('should enforce script length limits', async () => {
      const longScript = 'a'.repeat(2001);
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          original_script: longScript,
          style: 'educational'
        }
      });

      await scriptRewriteHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.code).toBe('CONTENT_TOO_LARGE');
    });

    it('should validate target length if provided', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          original_script: 'Test script',
          style: 'professional',
          target_length: 3001 // Over limit
        }
      });

      await scriptRewriteHandler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.code).toBe('INVALID_LENGTH');
    });

    it('should handle additional requirements', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          original_script: 'Test script for requirements',
          style: 'emotional',
          additional_requirements: 'Add more metaphors'
        }
      });

      await scriptRewriteHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.success).toBe(true);
      expect(data.data.style_applied).toBe('emotional');
    });

    it('should track processing time', async () => {
      const { req, res } = createMocks({
        method: 'POST' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        },
        body: {
          original_script: 'Test script',
          style: 'humorous'
        }
      });

      await scriptRewriteHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.data.processing_time).toBeDefined();
      expect(data.data.processing_time).toBeGreaterThan(0);
      expect(data.data.processing_time).toBeLessThan(8000); // Should be under 8s
    });
  });

  describe('CORS and OPTIONS handling', () => {
    it('should handle OPTIONS request for text-generation', async () => {
      const { req, res } = createMocks({
        method: 'OPTIONS' as RequestMethod
      });

      await textGenerationHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getHeaders()['access-control-allow-origin']).toBe('*');
      expect(res._getHeaders()['access-control-allow-methods']).toContain('POST');
    });

    it('should handle OPTIONS request for script-rewrite', async () => {
      const { req, res } = createMocks({
        method: 'OPTIONS' as RequestMethod
      });

      await scriptRewriteHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(res._getHeaders()['access-control-allow-origin']).toBe('*');
    });
  });

  describe('Method validation', () => {
    it('should reject GET request for text-generation', async () => {
      const { req, res } = createMocks({
        method: 'GET' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        }
      });

      await textGenerationHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const data = JSON.parse(res._getData());
      expect(data.code).toBe('METHOD_NOT_ALLOWED');
    });

    it('should reject PUT request for script-rewrite', async () => {
      const { req, res } = createMocks({
        method: 'PUT' as RequestMethod,
        headers: {
          'Authorization': `Bearer ${validApiKey}`
        }
      });

      await scriptRewriteHandler(req, res);

      expect(res._getStatusCode()).toBe(405);
      const data = JSON.parse(res._getData());
      expect(data.error).toContain('Only POST method is allowed');
    });
  });
});