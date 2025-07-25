import os
import json
import logging
import tempfile
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS
import yt_dlp
from werkzeug.exceptions import BadRequest

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置
MAX_DURATION = 600  # 最大视频时长：10分钟
MAX_FILESIZE = 100 * 1024 * 1024  # 最大文件大小：100MB

class VideoProcessor:
    """视频处理核心类"""
    
    @staticmethod
    def extract_video_info(url):
        """提取视频信息"""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            'format': 'best[ext=mp4]/best',
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # 检查视频时长
                duration = info.get('duration', 0)
                if duration > MAX_DURATION:
                    raise ValueError(f'视频时长超过限制：{duration}秒 > {MAX_DURATION}秒')
                
                return {
                    'title': info.get('title', 'Unknown'),
                    'duration': duration,
                    'uploader': info.get('uploader', 'Unknown'),
                    'view_count': info.get('view_count', 0),
                    'like_count': info.get('like_count', 0),
                    'description': info.get('description', '')[:200],  # 只取前200字符
                }
        except Exception as e:
            logger.error(f'提取视频信息失败: {str(e)}')
            raise
    
    @staticmethod
    def download_and_extract_audio(url, output_path):
        """下载视频并提取音频"""
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_path + '.%(ext)s',
            'quiet': True,
            'no_warnings': True,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
                # 返回生成的 mp3 文件路径
                mp3_path = output_path + '.mp3'
                if os.path.exists(mp3_path):
                    return mp3_path
                else:
                    raise FileNotFoundError('音频提取失败')
        except Exception as e:
            logger.error(f'下载和提取音频失败: {str(e)}')
            raise

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    try:
        # 检查 yt-dlp
        yt_dlp_version = yt_dlp.version.__version__
        
        # 检查 ffmpeg
        ffmpeg_result = subprocess.run(['ffmpeg', '-version'], 
                                     capture_output=True, text=True)
        ffmpeg_available = ffmpeg_result.returncode == 0
        
        return jsonify({
            'status': 'healthy',
            'yt_dlp_version': yt_dlp_version,
            'ffmpeg_available': ffmpeg_available,
            'message': 'Video processing service is running'
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/process', methods=['POST'])
def process_video():
    """处理视频的主端点"""
    try:
        # 获取请求数据
        data = request.get_json()
        if not data or 'url' not in data:
            raise BadRequest('Missing required parameter: url')
        
        url = data['url']
        logger.info(f'开始处理视频: {url}')
        
        # 1. 提取视频信息
        video_info = VideoProcessor.extract_video_info(url)
        logger.info(f'视频信息: {video_info["title"]} ({video_info["duration"]}秒)')
        
        # 2. 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='') as tmp_file:
            temp_path = tmp_file.name
        
        try:
            # 3. 下载并提取音频
            audio_path = VideoProcessor.download_and_extract_audio(url, temp_path)
            
            # 4. 读取音频文件（用于返回）
            with open(audio_path, 'rb') as f:
                audio_data = f.read()
            
            # 5. 获取文件大小
            file_size = os.path.getsize(audio_path)
            
            # 6. 清理临时文件
            os.unlink(audio_path)
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            
            # 7. 返回结果
            return jsonify({
                'success': True,
                'video_info': video_info,
                'audio': {
                    'size': file_size,
                    'format': 'mp3',
                    'data': audio_data.hex()  # 转为十六进制字符串传输
                }
            })
            
        except Exception as e:
            # 清理临时文件
            if 'audio_path' in locals() and os.path.exists(audio_path):
                os.unlink(audio_path)
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            raise e
            
    except BadRequest as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        logger.error(f'处理视频失败: {str(e)}')
        return jsonify({
            'success': False,
            'error': f'处理失败: {str(e)}'
        }), 500

@app.route('/', methods=['GET'])
def index():
    """首页"""
    return jsonify({
        'service': 'Railway Video Processing Service',
        'version': '1.0.0',
        'endpoints': {
            '/health': 'Health check',
            '/process': 'Process video (POST)',
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)