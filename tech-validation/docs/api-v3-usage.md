# Transcribe V3 API 使用指南

## API 端点
```
https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple
```

## 请求格式

### 方法
`POST`

### Headers
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer YOUR_API_KEY"
}
```

### 请求体
```json
{
  "mixedText": "看这个视频 https://v.douyin.com/xxx/ 太好笑了",
  "style": "humorous"
}
```

或

```json
{
  "videoUrl": "https://v.douyin.com/xxx/",
  "style": "default"
}
```

### 参数说明
- `mixedText` (可选): 包含视频链接的混合文本
- `videoUrl` (可选): 直接的视频链接
- `style` (可选): 脚本风格，可选值：
  - `default`: 默认风格
  - `humorous`: 幽默风格
  - `professional`: 专业风格

> 注意：`mixedText` 和 `videoUrl` 必须提供其中一个

## 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    "originalText": "转录的文本内容",
    "script": {
      "scenes": [
        {
          "scene_number": 1,
          "timestamp": "0:00-0:10",
          "description": "场景描述",
          "dialogue": "对话内容",
          "notes": "拍摄备注"
        }
      ]
    },
    "processingTime": 9208,
    "provider": {
      "videoResolver": "Direct",
      "transcription": "Mock",
      "scriptGenerator": "TongYi"
    }
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误信息",
    "userMessage": "用户友好的错误信息",
    "retryable": true
  }
}
```

## 错误代码
- `METHOD_NOT_ALLOWED`: 请求方法不正确
- `UNAUTHORIZED`: 未提供有效的 API 密钥
- `VALIDATION_ERROR`: 参数验证失败
- `NO_VIDEO_LINK`: 未找到有效的视频链接
- `INTERNAL_ERROR`: 服务器内部错误

## 使用示例

### JavaScript/Fetch
```javascript
const response = await fetch('https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    mixedText: '看这个视频 https://v.douyin.com/xxx/ 太好笑了',
    style: 'humorous'
  })
});

const data = await response.json();
console.log(data);
```

### Python
```python
import requests

url = 'https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
}
data = {
    'mixedText': '看这个视频 https://v.douyin.com/xxx/ 太好笑了',
    'style': 'humorous'
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

### cURL
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "mixedText": "看这个视频 https://v.douyin.com/xxx/ 太好笑了",
    "style": "humorous"
  }'
```

## 注意事项
1. API 有 60 秒的超时限制
2. 目前视频转文字使用模拟数据
3. 未来会集成真实的视频解析和转录服务
4. 建议使用 HTTPS 调用 API

## 后续更新计划
- [ ] 集成 TikHub API 进行真实视频地址解析
- [ ] 集成云猫转码进行真实视频转文字
- [ ] 添加更多视频平台支持
- [ ] 实现结果缓存机制
- [ ] 支持批量处理