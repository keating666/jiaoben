# Railway Video Processing Service

专门为处理抖音等视频平台的视频下载和音频提取服务。

## 功能

- 视频信息提取
- 视频下载
- 音频提取（MP3格式）
- 支持抖音、YouTube等主流平台

## 部署到 Railway

1. Fork 或上传此代码到 GitHub
2. 在 Railway 创建新项目
3. 选择 "Deploy from GitHub repo"
4. 选择此仓库
5. Railway 会自动检测并部署

## 环境会自动配置

- Python 3.11
- FFmpeg
- 所有必需的依赖

## API 端点

### 健康检查
```
GET /health
```

### 处理视频
```
POST /process
Content-Type: application/json

{
  "url": "https://v.douyin.com/xxxxx"
}
```

## 本地测试

```bash
pip install -r requirements.txt
python app.py
```

## 注意事项

- 最大视频时长：10分钟
- 最大文件大小：100MB
- 音频格式：MP3 192kbps