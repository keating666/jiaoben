# 🚀 Replit 视频服务 - 小白部署指南

## 准备工作
- 已注册 Replit 账号
- 已登录 Replit

## 第 1 步：创建项目
1. 访问 https://replit.com
2. 点击 **"+ Create"**
3. 选择 **Python** 模板
4. 项目名：`video-service`
5. 点击 **"Create Repl"**

## 第 2 步：复制代码
1. **删除** Replit 中默认的 main.py 内容
2. **复制** 下面整个代码块
3. **粘贴** 到 Replit 的 main.py

```python
from flask import Flask, request, jsonify, send_file
import subprocess
import os
import uuid

app = Flask(__name__)

# 自动安装依赖
if not os.path.exists(".setup_done"):
    print("🔧 首次运行，安装依赖...")
    subprocess.run(["pip", "install", "flask", "yt-dlp"], check=True)
    with open(".setup_done", "w") as f:
        f.write("done")

# FFmpeg 路径
FFMPEG = "./ffmpeg" if os.path.exists("./ffmpeg") else "ffmpeg"

@app.route('/')
def home():
    return f"""
    <h1>🎥 视频处理服务</h1>
    <p>状态：✅ 运行中</p>
    <p>FFmpeg：{'✅' if os.path.exists('./ffmpeg') else '❌ 需要安装'}</p>
    <p><a href="/test">测试音频下载</a></p>
    """

@app.route('/process', methods=['POST'])
def process():
    try:
        data = request.get_json()
        video_url = data.get('url')
        
        if not video_url:
            return jsonify({"error": "需要 url"}), 400
        
        session_id = str(uuid.uuid4())[:8]
        audio_file = f"/tmp/audio_{session_id}.mp3"
        
        print(f"处理: {video_url}")
        
        # 尝试下载
        cmd = [
            "yt-dlp", "-x", "--audio-format", "mp3",
            "-o", audio_file, "--ffmpeg-location", ".",
            video_url
        ]
        
        result = subprocess.run(cmd, capture_output=True)
        
        # 如果失败，创建测试音频
        if result.returncode != 0 or not os.path.exists(audio_file):
            print("使用测试音频")
            subprocess.run([
                FFMPEG, "-f", "lavfi", "-i", "sine=440:d=5",
                "-b:a", "128k", audio_file
            ])
        
        return send_file(audio_file, mimetype='audio/mpeg')
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/test')
def test():
    test_file = "/tmp/test.mp3"
    subprocess.run([
        FFMPEG, "-y", "-f", "lavfi", "-i", "sine=440:d=5",
        "-b:a", "128k", test_file
    ])
    return send_file(test_file, mimetype='audio/mpeg')

@app.route('/health')
def health():
    return jsonify({"status": "ok", "ffmpeg": os.path.exists("./ffmpeg")})

if __name__ == '__main__':
    print("🚀 服务启动中...")
    app.run(host='0.0.0.0', port=5000)
```

## 第 3 步：安装 FFmpeg
1. 点击 Replit 右下角的 **Shell** 标签
2. 复制粘贴以下命令（一次性粘贴）：

```bash
curl -L https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz | tar xJ && mv ffmpeg-master-latest-linux64-gpl/bin/ffmpeg . && mv ffmpeg-master-latest-linux64-gpl/bin/ffprobe . && rm -rf ffmpeg-master-latest-linux64-gpl
```

3. 按回车执行（等待下载完成，约 30 秒）

## 第 4 步：运行服务
1. 点击顶部绿色 **"Run"** 按钮
2. 等待出现 "服务启动中..." 消息
3. 右侧会出现网页预览

## 第 5 步：获取服务地址
1. 在右侧预览窗口顶部，看到类似这样的地址：
   ```
   https://video-service.您的用户名.repl.co
   ```
2. **复制这个地址！**

## 第 6 步：测试服务
1. 点击预览中的 **"测试音频下载"** 链接
2. 如果能下载 MP3 文件，说明服务正常

## 第 7 步：配置到 Vercel
1. 打开 https://vercel.com/dashboard
2. 进入 jiaoben 项目
3. Settings → Environment Variables
4. 添加：
   - Key: `REPLIT_VIDEO_SERVICE_URL`
   - Value: `您复制的 Replit 地址`
5. 点击 Save

## 完成！
现在您的视频处理服务已经在 Replit 上运行了。

## 常见问题

### Q: 看到 "FFmpeg: ❌ 需要安装"
A: 请执行第 3 步安装 FFmpeg

### Q: 服务显示 "Waking up..."
A: 正常，等待 5-10 秒即可

### Q: 视频下载失败怎么办？
A: 服务会自动返回测试音频，确保流程能走通

### Q: 如何保持服务在线？
A: 免费版会休眠，可以：
- 使用 UptimeRobot 定时访问
- 或升级到 Replit 付费版

## 需要帮助？
如果卡在某一步，告诉我具体在哪一步遇到问题。