# Transcribe V2 API 文档

## 概述

Transcribe V2 API 是一个增强版的视频转文字服务，支持多个第三方服务提供商，包括 MiniMax 和云猫转码。该 API 能够智能选择最合适的服务商，并提供故障转移功能。

## 主要特性

- **多服务商支持**：集成 MiniMax 和云猫转码，未来可扩展更多服务商
- **智能路由**：根据输入类型和服务可用性自动选择最佳服务商
- **直接视频处理**：云猫转码支持直接处理视频 URL，无需下载
- **故障转移**：当一个服务商失败时自动切换到备用服务商
- **增强的链接提取**：使用健壮的抖音链接提取器，支持各种格式
- **对话模式支持**：云猫转码支持多人对话场景识别

## API 端点

```
POST /api/video/transcribe-v2
```

## 请求参数

### Headers

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### Body

```json
{
  "video_url": "https://v.douyin.com/xxxxx/",  // 视频 URL（可选，与 mixedText 二选一）
  "mixedText": "看这个视频 https://v.douyin.com/xxxxx/ 很有趣",  // 混合文本（可选）
  "provider": "auto",  // 服务提供商：auto（默认）、minimax、yunmao
  "style": "default",  // 脚本风格：default、humorous、professional
  "language": "zh",    // 语言代码
  "options": {
    "dialogueMode": false,  // 是否开启对话模式（云猫转码支持）
    "speakerCount": 2,      // 说话人数量（对话模式时使用）
    "waitForResult": true   // 是否等待结果（默认 true）
  }
}
```

### 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| video_url | string | 否 | 视频 URL，与 mixedText 二选一 |
| mixedText | string | 否 | 包含视频链接的混合文本 |
| provider | string | 否 | 指定服务提供商，默认 "auto" |
| style | string | 否 | 脚本风格，默认 "default" |
| language | string | 否 | 语言代码，默认 "zh" |
| options | object | 否 | 额外选项 |

### 支持的语言

| 代码 | 语言 |
|------|------|
| zh | 中文（普通话） |
| en | 英语 |
| ja | 日语 |
| ko | 韩语 |
| es | 西班牙语 |
| fr | 法语 |
| de | 德语 |
| ru | 俄语 |
| ar | 阿拉伯语 |
| pt | 葡萄牙语 |

## 响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    "original_text": "这是视频的转录文本...",
    "script": {
      "title": "视频脚本标题",
      "duration": 120,
      "scenes": [
        {
          "scene_number": 1,
          "timestamp": "00:00-00:15",
          "description": "场景描述",
          "dialogue": "对话内容",
          "notes": "拍摄备注"
        }
      ]
    },
    "processing_time": 15000,
    "provider": "yunmao",
    "metadata": {
      "taskId": "task-123",
      "wordCount": 500,
      "confidence": 0.95,
      "duration": 120
    }
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "INVALID_VIDEO_URL",
    "message": "无效的视频链接",
    "details": {
      "video_url": "https://invalid.com/video"
    },
    "processing_time": 500
  }
}
```

## 错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| UNAUTHORIZED | 401 | API 密钥无效或缺失 |
| INVALID_REQUEST | 400 | 请求参数无效 |
| INVALID_VIDEO_URL | 400 | 视频 URL 格式错误 |
| NO_VIDEO_LINK | 400 | 无法从文本中提取视频链接 |
| VIDEO_TOO_LONG | 400 | 视频时长超过限制 |
| VIDEO_DOWNLOAD_FAILED | 422 | 视频下载失败 |
| TRANSCRIPTION_FAILED | 422 | 转录失败 |
| SCRIPT_GENERATION_FAILED | 422 | 脚本生成失败 |
| PROVIDER_NOT_AVAILABLE | 503 | 指定的服务提供商不可用 |
| ALL_PROVIDERS_FAILED | 503 | 所有服务提供商都失败 |
| API_QUOTA_EXCEEDED | 429 | API 配额已用完 |
| PROCESSING_TIMEOUT | 504 | 处理超时 |

## 使用示例

### 1. 基本使用（自动选择服务商）

```bash
curl -X POST https://your-domain.com/api/video/transcribe-v2 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://v.douyin.com/iRyLb8kf/"
  }'
```

### 2. 从混合文本提取链接

```bash
curl -X POST https://your-domain.com/api/video/transcribe-v2 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mixedText": "看这个视频 https://v.douyin.com/iRyLb8kf/ 太搞笑了 #搞笑 #日常",
    "style": "humorous"
  }'
```

### 3. 指定使用云猫转码（支持对话模式）

```bash
curl -X POST https://your-domain.com/api/video/transcribe-v2 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://example.com/interview.mp4",
    "provider": "yunmao",
    "options": {
      "dialogueMode": true,
      "speakerCount": 2
    }
  }'
```

### 4. 使用 JavaScript/TypeScript

```typescript
async function transcribeVideo(videoUrl: string) {
  const response = await fetch('https://your-domain.com/api/video/transcribe-v2', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      video_url: videoUrl,
      style: 'professional',
      language: 'zh'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`转录失败: ${error.error.message}`);
  }

  const result = await response.json();
  return result.data;
}
```

## 服务商特性对比

| 特性 | MiniMax | 云猫转码 |
|------|---------|----------|
| 直接处理视频 URL | ❌ | ✅ |
| 需要下载视频 | ✅ | ❌ |
| 对话模式 | ❌ | ✅ |
| 多语言支持 | ✅ | ✅ |
| 处理速度 | 快 | 中等 |
| 准确率 | 高 | 很高（98%） |

## 最佳实践

1. **使用 auto 模式**：让系统自动选择最合适的服务商
2. **错误处理**：实现重试机制，特别是对于网络错误
3. **超时设置**：建议设置客户端超时为 120 秒
4. **并发限制**：API 限制最多 3 个并发请求
5. **缓存结果**：对于相同的视频，考虑缓存转录结果

## 注意事项

1. **视频时长限制**：建议视频时长不超过 10 分钟
2. **文件大小限制**：视频文件不应超过 500MB
3. **API 配额**：请注意各服务商的 API 配额限制
4. **隐私保护**：不要在视频中包含敏感信息

## 环境变量配置

在 `.env` 文件中配置以下环境变量：

```env
# MiniMax 配置
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_GROUP_ID=your_minimax_group_id

# 云猫转码配置
YUNMAO_API_KEY=your_yunmao_api_key
YUNMAO_API_SECRET=your_yunmao_api_secret

# 通义千问配置（用于脚本生成）
TONGYI_API_KEY=your_tongyi_api_key
```

## 更新日志

### v2.0.0 (2024-01-24)
- 新增云猫转码服务支持
- 实现多服务商架构
- 增强链接提取功能
- 添加对话模式支持
- 改进错误处理和故障转移