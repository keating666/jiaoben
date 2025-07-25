# Vercel 函数日志查看指南

## 查看实时日志

### 方法 1：Vercel CLI（推荐）
```bash
# 查看实时日志
vercel logs --follow

# 查看特定函数的日志
vercel logs api/video/transcribe.ts --follow
```

### 方法 2：Vercel Dashboard
1. 登录 Vercel Dashboard
2. 进入项目：jiaoben
3. 点击 "Functions" 标签
4. 选择 `api/video/transcribe`
5. 查看 "Logs" 部分

## 常见错误排查

### METADATA_FETCH_FAILED
- **原因**：yt-dlp 无法获取视频信息
- **可能的问题**：
  - Headers 不正确（已修复）
  - 视频链接无效或过期
  - yt-dlp 版本问题
  - 网络访问限制

### 调试步骤
1. 查看完整错误日志
2. 检查视频链接是否有效
3. 验证环境变量是否设置：
   - MINIMAX_API_KEY
   - TONGYI_API_KEY

### 测试其他视频平台
如果抖音链接持续失败，可以尝试：
- YouTube: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Bilibili: `https://www.bilibili.com/video/BV1GJ411x7h7`

## 快速诊断命令
```bash
# 检查部署状态
vercel

# 查看环境变量（不显示值）
vercel env ls

# 查看最近的部署
vercel list
```