"""
Replit 视频处理微服务
处理视频下载和音频提取，供 Vercel 主服务调用
"""

from flask import Flask, request, jsonify, send_file
import yt_dlp
import subprocess
import os
import uuid
import tempfile
import logging
from datetime import datetime
import shutil

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# 配置
TEMP_DIR = tempfile.gettempdir()
MAX_VIDEO_DURATION = 60  # 秒
ALLOWED_DOMAINS = ['douyin.com', 'tiktok.com', 'youtube.com', 'bilibili.com']

# 确保 FFmpeg 可用
def check_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        return True
    except:
        return False

@app.route('/')
def home():
    return jsonify({
        "service": "Video Processing Microservice",
        "status": "running",
        "endpoints": {
            "/health": "健康检查",
            "/process": "处理视频并提取音频",
            "/download": "仅下载视频信息"
        },
        "ffmpeg": check_ffmpeg()
    })

@app.route('/health')
def health():
    return jsonify({
        "status": "healthy",
        "ffmpeg_available": check_ffmpeg(),
        "temp_dir": TEMP_DIR,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/process', methods=['POST'])
def process_video():
    """
    处理视频：下载并提取音频
    请求体: { "video_url": "https://..." }
    返回: 音频文件
    """
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        
        if not video_url:
            return jsonify({"error": "缺少 video_url 参数"}), 400
        
        # 验证 URL 域名
        if not any(domain in video_url for domain in ALLOWED_DOMAINS):
            return jsonify({"error": "不支持的视频平台"}), 400
        
        session_id = str(uuid.uuid4())
        temp_video = os.path.join(TEMP_DIR, f"video_{session_id}.mp4")
        temp_audio = os.path.join(TEMP_DIR, f"audio_{session_id}.mp3")
        
        logging.info(f"开始处理视频: {video_url}")
        
        # 配置 yt-dlp
        ydl_opts = {
            'format': 'best[ext=mp4]/best',
            'outtmpl': temp_video,
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'max_downloads': 1,
            'match_filter': duration_filter,
            'cookiefile': 'cookies.txt' if os.path.exists('cookies.txt') else None,
        }
        
        # 下载视频
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=True)
            duration = info.get('duration', 0)
            title = info.get('title', 'Unknown')
            
        logging.info(f"视频下载完成: {title} ({duration}秒)")
        
        # 使用 FFmpeg 提取音频
        ffmpeg_cmd = [
            'ffmpeg',
            '-i', temp_video,
            '-vn',  # 不要视频
            '-acodec', 'libmp3lame',
            '-ab', '128k',
            '-ar', '44100',
            '-y',  # 覆盖输出
            temp_audio
        ]
        
        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
        logging.info(f"音频提取完成: {temp_audio}")
        
        # 清理视频文件，保留音频
        if os.path.exists(temp_video):
            os.remove(temp_video)
        
        # 返回音频文件
        response = send_file(
            temp_audio,
            mimetype='audio/mpeg',
            as_attachment=True,
            download_name=f"audio_{session_id}.mp3"
        )
        
        # 添加元数据到响应头
        response.headers['X-Video-Duration'] = str(duration)
        response.headers['X-Video-Title'] = title
        response.headers['X-Session-Id'] = session_id
        
        return response
        
    except Exception as e:
        logging.error(f"处理失败: {str(e)}")
        return jsonify({
            "error": "视频处理失败",
            "message": str(e)
        }), 500

@app.route('/download', methods=['POST'])
def download_info():
    """
    仅获取视频信息，不下载
    """
    try:
        data = request.get_json()
        video_url = data.get('video_url')
        
        if not video_url:
            return jsonify({"error": "缺少 video_url 参数"}), 400
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'skip_download': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            
        return jsonify({
            "title": info.get('title', 'Unknown'),
            "duration": info.get('duration', 0),
            "uploader": info.get('uploader', 'Unknown'),
            "description": info.get('description', ''),
            "thumbnail": info.get('thumbnail', ''),
            "formats": len(info.get('formats', [])),
            "url": video_url
        })
        
    except Exception as e:
        return jsonify({
            "error": "获取视频信息失败",
            "message": str(e)
        }), 500

def duration_filter(info):
    """过滤超长视频"""
    duration = info.get('duration', 0)
    if duration > MAX_VIDEO_DURATION:
        logging.warning(f"视频时长 {duration}秒 超过限制")
        return False
    return True

@app.route('/cleanup', methods=['POST'])
def cleanup():
    """清理临时文件"""
    try:
        pattern = os.path.join(TEMP_DIR, "audio_*.mp3")
        import glob
        files = glob.glob(pattern)
        removed = 0
        
        for file in files:
            try:
                # 只删除超过 1 小时的文件
                if os.path.getctime(file) < (datetime.now().timestamp() - 3600):
                    os.remove(file)
                    removed += 1
            except:
                pass
        
        return jsonify({
            "cleaned": removed,
            "remaining": len(files) - removed
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Replit 会自动设置端口
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)