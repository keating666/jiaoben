# 📊 Vercel Functions 日志查看完整指南

## 方法 1：Vercel Dashboard（推荐）

### 步骤：
1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择项目 `jiaoben`
3. 点击顶部导航栏的 **"Functions"** 标签（不是 Build Logs）
4. 找到 `/api/video/transcribe` 函数
5. 点击进入函数详情页
6. 在页面中会看到 **"Logs"** 部分

### 日志内容包括：
- 实时错误信息
- console.log 输出
- 执行时间
- 内存使用情况

## 方法 2：Vercel CLI（需要安装）

### 安装 Vercel CLI：
```bash
npm install -g vercel
```

### 登录：
```bash
vercel login
```

### 查看实时日志：
```bash
# 查看所有函数日志
vercel logs --follow

# 查看特定函数日志
vercel logs api/video/transcribe.ts --follow

# 查看最近 100 条日志
vercel logs -n 100
```

## 日志示例解读

### 成功的日志：
```
[时间戳] 📊 获取视频元数据: https://v.douyin.com/xxx
[时间戳] ✅ 找到 yt-dlp: /var/task/bin/yt-dlp
[时间戳] 执行命令: "/var/task/bin/yt-dlp" --dump-json ...
```

### 失败的日志：
```
[时间戳] ❌ 获取视频元数据失败: Error: yt-dlp 未找到
[时间戳] Error: METADATA_FETCH_FAILED
```

## 快速诊断

如果看到 "METADATA_FETCH_FAILED"，可能的原因：
1. yt-dlp 路径问题（最常见）
2. 视频链接无效
3. 抖音反爬虫策略更新
4. 网络访问限制

## 💡 提示
- Functions 日志与 Build 日志不同
- Build 日志只显示部署时的信息
- Functions 日志显示实际运行时的错误