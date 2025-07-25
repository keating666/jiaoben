# Replit 视频处理微服务

这是 Story 0.2 的视频处理微服务，专门处理视频下载和音频提取任务。

## 🚀 部署到 Replit

### 1. 创建新 Repl

1. 登录 [Replit](https://replit.com)
2. 点击 "Create Repl"
3. 选择 "Import from GitHub"
4. 粘贴仓库 URL 或上传这个文件夹

### 2. 配置环境

Replit 会自动：
- 安装 Python 依赖
- 安装 FFmpeg
- 配置端口

### 3. 运行服务

点击 "Run" 按钮，服务会自动启动在：
```
https://你的用户名-视频处理服务.repl.co
```

### 4. 测试服务

```bash
# 健康检查
curl https://你的服务.repl.co/health

# 获取视频信息
curl -X POST https://你的服务.repl.co/download \
  -H "Content-Type: application/json" \
  -d '{"video_url": "https://v.douyin.com/..."}'

# 处理视频（返回音频文件）
curl -X POST https://你的服务.repl.co/process \
  -H "Content-Type: application/json" \
  -d '{"video_url": "https://v.douyin.com/..."}' \
  -o audio.mp3
```

## 🔧 配置 Vercel 集成

在 Vercel 项目中添加环境变量：

```
REPLIT_VIDEO_SERVICE_URL=https://你的服务.repl.co
```

## 📝 API 端点

### GET /
服务信息和可用端点列表

### GET /health
健康检查，返回 FFmpeg 状态

### POST /download
获取视频信息（不下载）
- 请求：`{ "video_url": "..." }`
- 响应：视频元数据

### POST /process
处理视频并返回音频文件
- 请求：`{ "video_url": "..." }`
- 响应：MP3 音频文件

### POST /cleanup
清理超过 1 小时的临时文件

## ⚙️ 配置选项

### 支持的平台
- 抖音 (douyin.com)
- TikTok (tiktok.com)
- YouTube (youtube.com)
- 哔哩哔哩 (bilibili.com)

### 限制
- 最大视频时长：60 秒
- 音频格式：MP3 128kbps

## 🔒 安全性

1. 仅处理白名单域名的视频
2. 自动清理临时文件
3. 请求超时保护
4. 错误信息脱敏

## 💡 提示

### 处理抖音视频
如果遇到下载问题，可以：
1. 添加 cookies.txt 文件（从浏览器导出）
2. 使用移动端分享链接

### 性能优化
- Replit 免费版有 CPU 限制
- 视频处理可能需要 10-30 秒
- 建议实现缓存机制

## 🐛 故障排除

### FFmpeg 未找到
Replit 应该自动安装，如果没有：
```bash
# 在 Shell 中运行
nix-env -iA nixpkgs.ffmpeg-full
```

### yt-dlp 更新
```bash
pip install --upgrade yt-dlp
```

### 查看日志
在 Replit 控制台查看实时日志