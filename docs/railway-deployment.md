# Railway 视频处理服务部署指南

## 🚀 快速部署步骤（5分钟完成）

### 1. 准备工作
- 注册 [Railway 账号](https://railway.app)（GitHub 登录即可）
- 确保代码已推送到 GitHub

### 2. 创建 Railway 项目

由于 Railway 检测到了 Node.js 项目，我们需要使用以下方法之一：

#### 方法 A：使用环境变量（推荐）
1. 登录 Railway 后，点击 **"New Project"**
2. 选择 **"Deploy from GitHub repo"**
3. 选择 `jiaoben` 仓库
4. 部署后会失败，这是正常的
5. 进入项目设置，添加以下环境变量：
   ```
   NIXPACKS_BUILD_CMD=cd railway-video-service && pip install -r requirements.txt
   NIXPACKS_START_CMD=cd railway-video-service && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120
   NIXPACKS_PYTHON_VERSION=3.11
   ```
6. 重新部署

#### 方法 B：创建独立仓库
1. 复制 `railway-video-service` 文件夹到新位置
2. 创建新的 GitHub 仓库
3. 推送视频服务代码
4. 在 Railway 部署新仓库

### 3. 自动部署

Railway 会自动：
- 检测 Python 项目
- 安装 FFmpeg
- 安装所有依赖
- 启动服务

### 4. 获取服务 URL

部署完成后：
1. 在 Railway 项目页面
2. 点击 **"Settings"** 标签
3. 在 **"Domains"** 部分点击 **"Generate Domain"**
4. 获得类似 `https://your-app.up.railway.app` 的 URL

### 5. 配置 Vercel 环境变量

在 Vercel 项目设置中添加：
```
RAILWAY_VIDEO_SERVICE_URL=https://your-app.up.railway.app
```

## 📋 验证部署

### 测试健康检查
```bash
curl https://your-app.up.railway.app/health
```

应该返回：
```json
{
  "status": "healthy",
  "yt_dlp_version": "2024.1.14",
  "ffmpeg_available": true,
  "message": "Video processing service is running"
}
```

### 测试视频处理
```bash
curl -X POST https://your-app.up.railway.app/process \
  -H "Content-Type: application/json" \
  -d '{"url": "https://v.douyin.com/test"}'
```

## 🔧 故障排查

### 常见问题

1. **部署失败**
   - 检查 requirements.txt 是否正确
   - 查看 Railway 的构建日志

2. **FFmpeg 未安装**
   - Railway 应该自动安装，检查 nixpacks.toml 配置

3. **超时错误**
   - Railway 有 5 分钟的请求超时限制
   - 视频过长可能导致超时

### 监控和日志

在 Railway 控制台可以：
- 查看实时日志
- 监控资源使用
- 设置告警

## 💰 费用说明

- **免费额度**：每月 $5 信用额度
- **典型使用**：处理 1000+ 个短视频
- **超出后**：约 $0.01/GB 流量

## 🎯 下一步

1. 部署完成后，更新 Vercel 的环境变量
2. 测试完整的视频处理流程
3. 监控服务稳定性

## 需要帮助？

如果遇到问题：
1. 检查 Railway 部署日志
2. 确认环境变量设置正确
3. 测试服务健康状态