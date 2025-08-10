# Tongyi API Serverless Functions

This directory contains Vercel Serverless Functions for integrating with Tongyi (通义千问) AI services.

## 📋 Overview

Two main endpoints are provided:
- **Text Generation**: General-purpose text generation using Tongyi's language models
- **Script Rewrite**: Specialized endpoint for rewriting video scripts in different styles

## 🚀 Endpoints

### 1. Text Generation
**POST** `/api/tongyi/text-generation`

Generate text based on conversation messages.

#### Request Headers
```
Authorization: Bearer <api-key>
Content-Type: application/json
```

#### Request Body
```json
{
  "messages": [
    {
      "role": "system" | "user" | "assistant",
      "content": "string"
    }
  ],
  "model": "qwen-max",        // Optional: qwen-max, qwen-plus, qwen-turbo
  "max_tokens": 1500,          // Optional: 1-2000
  "temperature": 0.7,          // Optional: 0-1
  "stream": false              // Optional: Enable streaming response
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "content": "Generated text...",
    "usage": {
      "prompt_tokens": 100,
      "completion_tokens": 150,
      "total_tokens": 250
    },
    "model": "qwen-max"
  }
}
```

### 2. Script Rewrite
**POST** `/api/tongyi/script-rewrite`

Rewrite video scripts in different styles.

#### Request Body
```json
{
  "original_script": "Original script text...",
  "style": "humorous",         // Required: humorous, educational, emotional, professional
  "target_length": 500,         // Optional: 50-3000 characters
  "additional_requirements": "", // Optional: Extra instructions
  "stream": false              // Optional: Enable streaming
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "rewritten_script": "Rewritten script...",
    "style_applied": "humorous",
    "character_count": 487,
    "changes_summary": "Added humor elements...",
    "processing_time": 3250
  }
}
```

## ⚡ Streaming Support

Both endpoints support Server-Sent Events (SSE) streaming when `stream: true` is set.

### Streaming Response Format
```
data: {"content": "partial text...", "done": false}
data: {"content": "complete text", "done": true, "usage": {...}}
data: [DONE]
```

### Client Example (JavaScript)
```javascript
const response = await fetch('/api/tongyi/text-generation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello' }],
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  // Process streaming chunk
  console.log(chunk);
}
```

## 🔐 Security

### Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <api-key>
```

### Rate Limiting
- Text Generation: 10 requests per minute per IP
- Script Rewrite: 5 requests per minute per IP

### Request Size Limits
- Text Generation: 4000 characters total
- Script Rewrite: 2000 characters for original script

## ⚙️ Configuration

### Environment Variables
```env
# Required
TONGYI_API_KEY=your_tongyi_api_key
API_AUTH_KEY=your_api_auth_key

# Optional
TONGYI_BASE_URL=https://dashscope.aliyuncs.com/api/v1
TONGYI_MODEL=qwen-max
```

## 🧪 Testing

### Run Tests
```bash
npm test api/tongyi/__tests__/integration.test.ts
```

### Test Client
Open `api/tongyi/test-client.html` in a browser for interactive testing.

### Performance Benchmarks
- Text Generation: < 3 seconds for 500 tokens
- Script Rewriting: < 8 seconds for 1000 characters
- Streaming First Token: < 1 second
- Concurrent Requests: Supports 10 simultaneous

## 📊 Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes
- `UNAUTHORIZED`: Invalid or missing API key
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `CONTENT_TOO_LARGE`: Input exceeds size limits
- `INVALID_REQUEST`: Malformed request
- `TIMEOUT`: Request timed out (30s limit)
- `SERVICE_OVERLOAD`: Tongyi service overloaded

### Retry Strategy
For 429 (Rate Limit) and 503 (Service Overload) errors:
1. Implement exponential backoff starting at 1 second
2. Max retry attempts: 3
3. Max delay: 16 seconds

## 🎨 Script Styles

### Humorous (幽默风趣)
Adds humor, internet slang, and witty elements while maintaining core content.

### Educational (教育科普)
Transforms content into clear, educational format with easy-to-understand explanations.

### Emotional (情感丰富)
Enhances emotional resonance and creates connection with the audience.

### Professional (专业正式)
Uses formal language, industry terms, and professional tone.

## 📈 Monitoring

### Key Metrics
- Response Time (p95 < 8s)
- Success Rate (> 95%)
- Token Usage
- Cache Hit Rate

### Performance Optimization
1. **Connection Pooling**: Reuse Tongyi client instances
2. **Prompt Caching**: Cache frequently used prompts
3. **Streaming**: Use for responses > 500 characters
4. **Request Batching**: Group similar requests when possible

## 🔄 Version History

### v1.0.0 (2025-01-23)
- Initial implementation
- Text generation and script rewriting endpoints
- Streaming support
- Rate limiting and security features

## 📚 Additional Resources

- [Tongyi API Documentation](https://help.aliyun.com/zh/dashscope/)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Server-Sent Events Guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)