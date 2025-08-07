# Jiaoben - 抖音视频智能分镜脚本生成工具

## 项目简介

基于 Cloudflare Workers 的智能视频处理系统，实现从抖音链接到分镜脚本的自动化生成。

## 主要功能

- 🔗 抖音链接解析（通过 TikHub API）
- 🎵 音频提取和语音识别（腾讯云 ASR）
- 📝 智能分镜脚本生成（通义千问）
- ☁️ Serverless 部署（Cloudflare Workers）

## 技术架构

### 生产环境（Cloudflare Worker）
```
抖音链接 → TikHub API → 音频URL → 腾讯云ASR → 转写文本 → 通义千问 → 分镜脚本
```
- 核心实现：`/src/cloudflare-worker-tencent-asr.js`
- 部署地址：`https://jiaoben-api.keating8500.workers.dev`

### 开发环境（Vercel）
```
视频链接 → 视频下载 → MiniMax转写 → 通义千问 → 分镜脚本
```
- 核心实现：`/api/video/transcribe.ts`
- 部署地址：Vercel Serverless Functions

## 快速开始

### 1. 环境要求

- Node.js 18+
- Cloudflare 账号
- 腾讯云账号（已开通 ASR 服务）
- 阿里云账号（通义千问 API）
- TikHub API Token

### 2. 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量（在 Cloudflare Dashboard 中设置）
# - TENCENT_SECRET_ID
# - TENCENT_SECRET_KEY
# - TONGYI_API_KEY
# - TIKHUB_API_TOKEN

# 本地测试
wrangler dev

# 部署到 Cloudflare
wrangler deploy
```

### 3. 访问地址

- API 端点：https://jiaoben-api.keating8500.workers.dev
- 测试页面：https://jiaoben-project.pages.dev/test-tencent-asr.html
- 调试工具：https://jiaoben-project.pages.dev/debug-tencent-asr.html

## 项目结构

```
jiaoben/
├── src/                          # 源代码
│   └── cloudflare-worker-tencent-asr.js
├── public/                       # 公开页面
│   ├── index.html
│   ├── test-tencent-asr.html
│   └── debug-tencent-asr.html
├── tech-validation/              # TypeScript 技术验证
├── docs/                         # 项目文档
├── scripts/                      # 部署脚本
└── archive/                      # 历史版本归档
```

## API 使用

### 处理抖音视频

```bash
curl -X POST https://jiaoben-api.keating8500.workers.dev/api/process \
  -H "Content-Type: application/json" \
  -d '{"douyinUrl": "https://v.douyin.com/xxxxx/"}'
```

## 文档

- [部署指南](docs/CLOUDFLARE_DEPLOY_GUIDE.md)
- [API 参考](docs/API-REFERENCE.md)
- [故障排查](docs/TROUBLESHOOTING.md)

## 许可证

MIT License