# Vercel 环境变量配置指南

## 概述

本文档说明如何在 Vercel 中配置视频转文字服务所需的环境变量。

## 需要配置的环境变量

### 1. MiniMax API 配置
- `MINIMAX_API_KEY` - MiniMax API 密钥（必需）
- `MINIMAX_GROUP_ID` - MiniMax 群组 ID（必需）
- `MINIMAX_API_BASE_URL` - API 基础 URL（可选，默认：https://api.minimax.chat）

### 2. 通义千问 API 配置
- `TONGYI_API_KEY` - 通义千问 API 密钥（必需）
- `TONGYI_API_BASE_URL` - API 基础 URL（可选，默认：https://dashscope.aliyuncs.com）

### 3. 讯飞星火 API 配置
- `IFLYTEK_API_KEY` - 讯飞 API 密钥（必需）
- `IFLYTEK_APP_ID` - 讯飞应用 ID（必需）
- `IFLYTEK_API_SECRET` - 讯飞 API 密钥（必需）
- `IFLYTEK_API_BASE_URL` - API 基础 URL（可选，默认：https://iat-api.xfyun.cn）

### 4. 通用配置
- `API_TIMEOUT` - API 超时时间（可选，默认：30000）
- `MAX_RETRIES` - 最大重试次数（可选，默认：3）
- `RETRY_DELAY_BASE` - 重试延迟基数（可选，默认：1000）
- `LOG_LEVEL` - 日志级别（可选，默认：info）

## 配置步骤

### 方法一：通过 Vercel 仪表板配置（推荐）

1. 登录 [Vercel 仪表板](https://vercel.com/dashboard)
2. 选择项目 `jiaoben`
3. 进入 Settings → Environment Variables
4. 添加环境变量：
   - Key: 环境变量名称
   - Value: 环境变量值
   - Environment: 选择 Production、Preview 和 Development
5. 点击 Save

### 方法二：使用 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 设置环境变量
vercel env add MINIMAX_API_KEY production
vercel env add MINIMAX_GROUP_ID production
vercel env add TONGYI_API_KEY production
# ... 继续添加其他变量
```

### 方法三：使用 .env.production.local（本地开发）

创建 `.env.production.local` 文件：

```env
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_GROUP_ID=your_minimax_group_id
TONGYI_API_KEY=your_tongyi_api_key
IFLYTEK_API_KEY=your_iflytek_api_key
IFLYTEK_APP_ID=your_iflytek_app_id
IFLYTEK_API_SECRET=your_iflytek_api_secret
```

## 验证配置

### 1. 检查环境变量是否生效

部署后访问健康检查端点：
```bash
curl https://jiaoben-7jx4.vercel.app/api
```

### 2. 查看配置摘要

在 Vercel Functions 日志中查看配置状态：
- 进入 Vercel 仪表板
- 选择 Functions 标签
- 查看 `api/video/transcribe` 函数日志

### 3. 测试完整工作流

使用测试页面验证：
```
https://jiaoben-7jx4.vercel.app/video-transcribe-dashboard.html
```

## 注意事项

1. **安全性**：
   - 不要在代码中硬编码 API 密钥
   - 不要将包含真实密钥的 .env 文件提交到 Git
   - 使用 Vercel 的环境变量功能安全存储密钥

2. **作用域**：
   - Production: 生产环境
   - Preview: 预览环境（PR 部署）
   - Development: 开发环境（本地开发）

3. **更新后重新部署**：
   - 修改环境变量后需要重新部署才能生效
   - 可以通过 Vercel 仪表板触发重新部署

## 故障排除

### 环境变量未生效
1. 确认环境变量已保存
2. 检查环境变量名称是否正确（区分大小写）
3. 确认已重新部署

### API 调用失败
1. 检查 API 密钥是否正确
2. 验证 API 服务是否可用
3. 查看 Vercel Functions 日志获取详细错误信息

### 配置验证失败
运行配置验证脚本：
```bash
node tech-validation/scripts/validate-env.js
```

## 相关文档

- [Vercel 环境变量文档](https://vercel.com/docs/environment-variables)
- [项目 README](../README.md)
- [API 文档](./api-documentation.md)