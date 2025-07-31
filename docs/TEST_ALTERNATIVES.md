# 备用测试方案

## 如果抖音链接持续失败

### 1. 测试其他平台视频
**YouTube 短视频**（10秒）：
```
https://www.youtube.com/watch?v=aqz-KE-bpKQ
```

**Bilibili 短视频**：
```
https://www.bilibili.com/video/BV1GJ411x7h7
```

### 2. 直接测试视频 URL
有时候短链接可能有问题，可以尝试：
1. 在浏览器中打开抖音短链接
2. 等待跳转到完整 URL
3. 复制完整的 URL 进行测试

### 3. 检查 Vercel 函数日志
```bash
# 实时查看日志
vercel logs --follow

# 或者在 Vercel Dashboard 查看
```

### 4. 使用混合文本测试
在输入框中粘贴包含链接的混合文本：
```
看看这个有趣的视频 https://v.douyin.com/iRyH8L8m/ 真的很好笑！
```

### 5. 本地测试命令
如果需要本地调试：
```bash
# 测试 yt-dlp 是否能获取视频信息
yt-dlp --dump-json "https://v.douyin.com/iRyH8L8m/"

# 查看 yt-dlp 版本
yt-dlp --version
```

## 常见问题

### Q: 为什么抖音链接失败？
A: 可能的原因：
- 抖音更新了反爬虫策略
- yt-dlp 版本需要更新
- 需要额外的 cookies 或认证

### Q: 如何更新 yt-dlp？
A: 在部署脚本中更新：
```bash
pip install -U yt-dlp
```

### Q: 是否支持其他国内平台？
A: yt-dlp 支持多个平台，包括：
- Bilibili
- 微博视频
- 爱奇艺（部分）
- 优酷（部分）