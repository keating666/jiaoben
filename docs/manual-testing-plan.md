# Story 0.2 手工测试计划

## 测试概述
本文档包含 Story 0.2（视频转文字编排服务）的完整手工测试计划。测试目标是验证所有功能正常工作，并确保系统在各种场景下的稳定性。

## 测试环境准备

### 1. 环境变量配置
```bash
export MINIMAX_API_KEY="your-minimax-api-key"
export DASHSCOPE_API_KEY="your-tongyi-api-key"
```

### 2. 本地启动服务
```bash
cd tech-validation
npm install
npm run dev
```

### 3. 测试工具准备
- Postman 或 curl（API 测试）
- 浏览器（查看响应）
- 计时器（性能测试）

## 测试用例

### TC001: 基础功能测试 - 成功案例

**目的**: 验证正常视频的完整处理流程

**测试数据**:
- YouTube 短视频: https://www.youtube.com/watch?v=dQw4w9WgXcQ (30秒)
- Bilibili 短视频: https://www.bilibili.com/video/BV1GJ411x7h7 (45秒)

**测试步骤**:
1. 发送 POST 请求到 `/api/video/transcribe`
```bash
curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "style": "default"
  }'
```

2. 验证响应格式
```json
{
  "success": true,
  "data": {
    "transcription": "...",
    "script": {
      "title": "...",
      "scenes": [...]
    },
    "metadata": {
      "duration": 30,
      "processingTime": ...
    }
  }
}
```

**期望结果**:
- [ ] 响应状态码 200
- [ ] 返回完整的转录文本
- [ ] 生成结构化的分镜脚本
- [ ] 处理时间 < 30秒

### TC002: 时长限制测试

**目的**: 验证 60 秒时长限制

**测试数据**:
- 59 秒视频: [准备一个 59 秒的视频 URL]
- 61 秒视频: [准备一个 61 秒的视频 URL]

**测试步骤**:
1. 测试 59 秒视频（应该成功）
2. 测试 61 秒视频（应该被拒绝）

**期望结果**:
- [ ] 59 秒视频处理成功
- [ ] 61 秒视频返回 400 错误
- [ ] 错误信息明确说明时长超限

### TC003: 样式参数测试

**目的**: 验证不同脚本样式

**测试步骤**:
1. 使用相同视频，分别测试三种样式：
   - style: "default"
   - style: "humorous"
   - style: "professional"

**期望结果**:
- [ ] 每种样式返回不同风格的脚本
- [ ] 脚本内容符合指定风格

### TC004: 错误处理测试

**目的**: 验证各种错误场景的处理

#### 4.1 无效 URL 测试
```bash
curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "url": "not-a-valid-url"
  }'
```
期望: 400 错误，"URL格式无效"

#### 4.2 不支持的网站
```bash
curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "url": "https://example.com/video.mp4"
  }'
```
期望: 可能成功或失败，取决于是否能下载

#### 4.3 私有/受限视频
测试需要登录或付费的视频 URL
期望: 返回适当的错误信息

#### 4.4 缺少认证
```bash
curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }'
```
期望: 401 错误，"缺少Authorization头"

### TC005: 安全性测试

**目的**: 验证安全防护措施

#### 5.1 SSRF 防护测试
```bash
# 测试内网地址
curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "url": "http://localhost:8080/admin"
  }'
```
期望: 400 错误，"不允许访问内网地址"

#### 5.2 XSS 防护测试
```bash
curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "style": "<script>alert(1)</script>"
  }'
```
期望: 400 错误，"style参数包含非法字符"

### TC006: 性能测试

**目的**: 验证系统性能和资源管理

#### 6.1 接近超时测试
使用一个 55-58 秒的视频，观察：
- [ ] 是否显示超时警告
- [ ] 处理是否在 60 秒内完成

#### 6.2 并发请求测试
同时发送 3 个请求：
```bash
# 在 3 个终端同时执行
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/video/transcribe \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_API_TOKEN" \
    -d '{
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    }' &
done
```

期望:
- [ ] 所有请求都能处理
- [ ] 没有内存泄漏或崩溃

### TC007: 国际化测试

**目的**: 验证多语言支持

**测试数据**:
- 中文视频 URL
- 英文视频 URL
- 日文视频 URL（如果支持）

**期望结果**:
- [ ] 正确识别和转录不同语言
- [ ] 生成相应语言的脚本

## 测试执行记录

| 测试用例 | 执行时间 | 执行人 | 结果 | 备注 |
|---------|---------|--------|------|------|
| TC001   |         |        | [ ]  |      |
| TC002   |         |        | [ ]  |      |
| TC003   |         |        | [ ]  |      |
| TC004   |         |        | [ ]  |      |
| TC005   |         |        | [ ]  |      |
| TC006   |         |        | [ ]  |      |
| TC007   |         |        | [ ]  |      |

## 问题记录

### 发现的问题
1. 问题描述：
   - 严重程度：
   - 复现步骤：
   - 期望行为：
   - 实际行为：

## 测试总结

### 通过标准
- [ ] 所有核心功能测试通过
- [ ] 无严重或阻塞性问题
- [ ] 性能符合预期（< 60秒超时）
- [ ] 安全防护有效

### 建议
1. 
2. 
3. 

## 附录：常用测试命令

### 基础测试
```bash
# 成功案例
curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token-1234567890123456789012345678" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# 带样式参数
curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token-1234567890123456789012345678" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "style": "humorous"}'
```

### 性能监控
```bash
# 使用 time 命令计时
time curl -X POST http://localhost:3000/api/video/transcribe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token-1234567890123456789012345678" \
  -d '{"url": "YOUR_VIDEO_URL"}'
```

### 日志查看
```bash
# 查看 Vercel 日志
vercel logs

# 本地开发日志
npm run dev
```