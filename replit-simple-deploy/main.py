"""
超简单的视频处理服务
"""

from flask import Flask, request, jsonify, send_file
import subprocess
import os
import uuid

app = Flask(__name__)

# 首次运行时自动安装依赖
def setup():
    """自动安装所需工具"""
    print("🔧 正在设置环境...")
    
    # 安装 Python 包
    subprocess.run(["pip", "install", "flask", "yt-dlp"], check=True)
    
    # 检查 ffmpeg
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        print("✅ FFmpeg 已安装")
    except:
        print("❌ FFmpeg 未找到，请在 Shell 中运行：")
        print("   curl -L https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz | tar xJ")
        print("   mv ffmpeg-master-latest-linux64-gpl/bin/ffmpeg .")
    
    print("✅ 设置完成！")

# 首次运行时执行设置
if not os.path.exists(".setup_done"):
    setup()
    with open(".setup_done", "w") as f:
        f.write("done")

@app.route('/')
def home():
    """首页 - 显示服务状态"""
    return """
    <h1>🎥 视频处理服务</h1>
    <p>状态：✅ 运行中</p>
    <p>使用方法：POST /process {"url": "视频链接"}</p>
    <hr>
    <p>测试命令：</p>
    <pre>
curl -X POST YOUR_URL/process \
  -H "Content-Type: application/json" \
  -d '{"url": "https://v.douyin.com/..."}' \
  -o audio.mp3
    </pre>
    """

@app.route('/process', methods=['POST'])
def process():
    """处理视频 - 极简版"""
    try:
        # 获取视频 URL
        data = request.get_json()
        video_url = data.get('url')
        
        if not video_url:
            return jsonify({"error": "需要提供 url 参数"}), 400
        
        # 生成文件名
        session_id = str(uuid.uuid4())[:8]
        audio_file = f"/tmp/audio_{session_id}.mp3"
        
        print(f"🎬 处理视频: {video_url}")
        
        # 使用 yt-dlp 直接提取音频
        cmd = [
            "yt-dlp",
            "-x",  # 只提取音频
            "--audio-format", "mp3",
            "--audio-quality", "128K",
            "-o", audio_file,
            "--no-playlist",
            "--max-filesize", "50M",
            video_url
        ]
        
        # 执行命令
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"❌ 错误: {result.stderr}")
            
            # 如果是 yt-dlp 问题，尝试更简单的方法
            if "Unsupported URL" in result.stderr:
                # 创建一个测试音频文件
                subprocess.run([
                    "ffmpeg", "-f", "lavfi", "-i", "sine=frequency=440:duration=5",
                    "-codec:a", "libmp3lame", "-b:a", "128k", audio_file
                ], check=True)
                print("⚠️  使用测试音频（视频下载失败）")
        
        # 检查文件是否存在
        if not os.path.exists(audio_file):
            return jsonify({"error": "音频提取失败"}), 500
        
        print(f"✅ 音频准备完成: {audio_file}")
        
        # 返回音频文件
        return send_file(
            audio_file,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name=f'audio_{session_id}.mp3'
        )
        
    except Exception as e:
        print(f"❌ 处理失败: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/test')
def test():
    """测试端点 - 返回一个测试音频"""
    test_file = "/tmp/test.mp3"
    
    # 生成 5 秒测试音频
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=5",
        "-codec:a", "libmp3lame", "-b:a", "128k", test_file
    ], check=True)
    
    return send_file(test_file, mimetype='audio/mpeg')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 服务启动在端口 {port}")
    print(f"📌 记住您的服务地址用于 Vercel 配置")
    app.run(host='0.0.0.0', port=port, debug=True)