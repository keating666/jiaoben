# 技术验证项目 - Story 1.0

本项目用于验证 AI 服务商 API 的技术可行性，包含语音转文字、文本再创作和 IP 诊断功能。

## 🚀 快速开始

### 1. 环境配置

1. 复制环境变量模板：
   ```bash
   cp .env.example .env
   ```

2. 在 `.env` 文件中填入你的 API 密钥

### 2. API 密钥获取地址

#### MiniMax
- **官网**: https://www.minimaxi.com/
- **控制台**: https://www.minimaxi.com/user-center/basic-information/interface-key
- **文档**: https://api.minimax.chat/document/guides/chat
- **需要获取**: API Key, Group ID

#### 通义千问 (阿里云)
- **官网**: https://dashscope.aliyun.com/
- **控制台**: https://dashscope.console.aliyun.com/apiKey
- **文档**: https://help.aliyun.com/zh/dashscope/
- **需要获取**: API Key

#### 讯飞星火
- **官网**: https://xinghuo.xfyun.cn/
- **控制台**: https://console.xfyun.cn/services/bm3
- **文档**: https://www.xfyun.cn/doc/asr/voicedictation/API.html
- **需要获取**: APP ID, API Secret, API Key

### 3. 项目结构

```
tech-validation/
├── scripts/                 # API 验证脚本
│   ├── minimax-speech-to-text.ts
│   ├── tongyi-text-generation.ts
│   └── ip-diagnosis.ts
├── test-data/               # 测试数据文件
│   ├── audio-30s.mp3
│   ├── audio-45s.mp3
│   └── audio-60s.mp3
├── interfaces/              # TypeScript 接口定义
├── utils/                   # 通用工具函数
├── .env                     # 环境变量 (不提交到 git)
├── .env.example            # 环境变量模板
├── package.json            # 项目依赖
└── README.md              # 本文件
```

## 📋 验证目标

- [x] 环境准备和项目初始化
- [ ] MiniMax API 集成验证 (语音转文字)
- [ ] 通义千问 API 集成验证 (文本生成)
- [ ] 讯飞星火 API 集成验证 (语音转文字备用)
- [ ] IP 诊断服务 API 验证
- [ ] 综合测试和文档

## 🔧 安全注意事项

- ❌ 绝不要将 API 密钥硬编码到代码中
- ❌ 绝不要提交 `.env` 文件到版本控制
- ✅ 所有敏感信息通过环境变量管理
- ✅ 使用 HTTPS 进行所有 API 调用
- ✅ 不在日志中记录 API 密钥