# 废弃服务存档

此目录包含已废弃但曾经使用过的服务实现。

## 废弃的服务

### YunmaoClient（云猫转码）
- **文件**：
  - `yunmao-client.ts` - 客户端实现
  - `yunmao-client.js` - JavaScript 版本
  - `yunmao-client.test.ts` - 单元测试
- **废弃原因**：改用腾讯云 ASR 作为主要语音识别服务
- **废弃时间**：2025-08-07

### IflyTekClient（科大讯飞）
- **文件**：
  - `iflytek-client.ts` - 客户端实现
- **废弃原因**：未在生产环境使用
- **废弃时间**：2025-08-07

## 当前使用的技术栈

### 生产环境（Cloudflare Worker）
- TikHub - 视频链接解析
- 腾讯云 ASR - 语音识别
- 通义千问 - 脚本生成

### 开发环境（Vercel）
- MiniMax - 语音识别（备用）
- 通义千问 - 脚本生成