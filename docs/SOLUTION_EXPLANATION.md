# 🔧 Story 0.2 解决方案说明

## 问题历程

### 1. 初始问题：METADATA_FETCH_FAILED
- 使用 youtube-dl-exec npm 包（基于旧版 youtube-dl）
- 无法处理抖音链接

### 2. 第一次尝试：使用真正的 yt-dlp 二进制文件
- 下载 yt-dlp 二进制文件到 bin 目录
- 问题：`Exec format error` - 架构不匹配

### 3. 第二次尝试：使用 Linux 版本
- 更改为下载 yt-dlp_linux
- 问题：`Error relocating /lib64/libz.so.1` - glibc 版本不兼容

### 4. 最终解决方案：youtube-dl-exec + yt-dlp
- 使用 youtube-dl-exec npm 包
- 通过 `youtubeDl: 'yt-dlp'` 选项强制使用 yt-dlp
- 让 youtube-dl-exec 自动管理二进制文件下载和兼容性

## 关键代码变更

```typescript
// 之前：手动管理二进制文件
execSync(`"${ytDlpPath}" --dump-json ...`);

// 现在：使用 youtube-dl-exec
await youtubedl(videoUrl, {
  dumpSingleJson: true,
  youtubeDl: 'yt-dlp',  // 强制使用 yt-dlp
  // ... 其他选项
});
```

## 为什么这个方案更好

1. **自动兼容性**：youtube-dl-exec 会自动下载适合当前环境的二进制文件
2. **避免系统依赖**：不需要担心 glibc 版本问题
3. **更简单的代码**：移除了复杂的路径查找逻辑
4. **更好的维护性**：由 npm 包管理依赖

## Vercel 环境特点

- 运行环境：Linux (较旧的 glibc 版本)
- 路径：`/var/task/`
- Node.js 版本：22.x
- 限制：不能使用需要新版 glibc 的二进制文件

## 经验教训

1. **优先使用 Node.js 生态系统的解决方案**
2. **避免直接管理二进制文件的兼容性**
3. **Vercel 环境可能使用较旧的系统库**
4. **youtube-dl-exec 2.x 版本支持 yt-dlp**