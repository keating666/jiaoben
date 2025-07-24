# 手工测试清单 - Story 0.2 视频转文字编排服务

## 测试准备
- [ ] 确认 API 部署地址：https://jiaoben-7jx4.vercel.app/api
- [ ] 准备测试用的 API Token（用于 Authorization header）
- [ ] 准备测试视频 URL（YouTube 或其他支持的平台）

## 功能测试清单

### 1. API 健康检查
- [ ] 访问 https://jiaoben-7jx4.vercel.app/api
- [ ] 验证返回 200 状态码
- [ ] 验证返回消息包含 "CI/CD 已经成功部署"

### 2. 视频转文字 API 测试

#### 2.1 正常请求测试
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "style": "default",
    "language": "zh"
  }'
```

**验证点：**
- [ ] 返回 200 状态码
- [ ] 响应包含 transcription 字段（转录文本）
- [ ] 响应包含 script 字段（分镜脚本）
- [ ] 响应包含 metadata 字段（视频元信息）

#### 2.2 安全验证测试

**测试内网地址拦截：**
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "videoUrl": "http://localhost:8080/video.mp4"
  }'
```
- [ ] 返回 400 错误
- [ ] 错误信息提示 "不允许访问内网地址"

**测试无效 URL：**
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "videoUrl": "not-a-valid-url"
  }'
```
- [ ] 返回 400 错误
- [ ] 错误信息提示 "URL格式无效"

#### 2.3 认证测试

**测试无认证头：**
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```
- [ ] 返回 401 错误
- [ ] 错误信息提示 "缺少Authorization头"

**测试无效 Token：**
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```
- [ ] 返回 401 错误
- [ ] 错误信息提示 Token 无效

#### 2.4 参数验证测试

**测试缺少必需参数：**
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{}'
```
- [ ] 返回 400 错误
- [ ] 错误信息提示缺少 videoUrl

**测试无效 style 参数：**
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "style": "invalid-style"
  }'
```
- [ ] 返回 400 错误
- [ ] 错误信息提示无效的 style 参数

### 3. 并发控制测试

发送多个并发请求（超过 3 个）：
```bash
# 在终端中同时运行 4 个请求
for i in {1..4}; do
  curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_API_TOKEN" \
    -d '{
      "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "sessionId": "test-'$i'"
    }' &
done
```
- [ ] 前 3 个请求应该被接受
- [ ] 第 4 个请求应该返回 429 错误（Too Many Requests）

### 4. 错误恢复测试

**测试无效视频 URL：**
```bash
curl -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=invalid-video-id"
  }'
```
- [ ] 返回适当的错误信息
- [ ] 不会导致服务崩溃

## 测试结果记录

| 测试项 | 状态 | 备注 |
|--------|------|------|
| API 健康检查 | ⬜ | |
| 正常请求测试 | ⬜ | |
| 安全验证测试 | ⬜ | |
| 认证测试 | ⬜ | |
| 参数验证测试 | ⬜ | |
| 并发控制测试 | ⬜ | |
| 错误恢复测试 | ⬜ | |

## 已知问题

1. **yt-dlp 二进制兼容性**：
   - 问题：Linux 环境下的 yt-dlp 执行格式错误
   - 影响：视频下载功能可能失败
   - 建议：需要为不同平台准备正确的二进制文件

2. **静态页面 404**：
   - 问题：Vercel 上的静态 HTML 页面返回 404
   - 影响：测试页面无法访问
   - 临时方案：使用 curl 或 Postman 进行 API 测试

## 测试环境信息
- 测试时间：_____
- 测试人员：_____
- API 版本：_____
- 环境：Vercel Production