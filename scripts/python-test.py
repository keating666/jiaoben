#!/usr/bin/env python3

import requests
import json
from datetime import datetime

# 禁用 SSL 警告（仅用于测试）
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

print("🎯 视频转文字 API 测试")
print("=" * 50)

BASE_URL = "https://jiaoben-7jx4.vercel.app"
API_TOKEN = "test-token-1234567890123456789012345678"

# 测试 1: API 健康检查
print("\n1️⃣ 测试 API 健康检查...")
try:
    response = requests.get(f"{BASE_URL}/api", verify=False, timeout=10)
    if response.status_code == 200:
        print("✅ API 在线!")
        data = response.json()
        print(f"   项目: {data.get('project', 'Unknown')}")
        print(f"   状态: {data.get('status', 'Unknown')}")
    else:
        print(f"❌ API 返回错误: {response.status_code}")
except Exception as e:
    print(f"❌ 连接失败: {str(e)}")
    exit(1)

# 测试 2: 视频转录
print("\n2️⃣ 测试视频转录功能...")
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_TOKEN}"
}
data = {
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "style": "default"
}

try:
    response = requests.post(
        f"{BASE_URL}/api/video/transcribe", 
        headers=headers,
        json=data,
        verify=False,
        timeout=60
    )
    
    if response.status_code == 200:
        result = response.json()
        if result.get("success"):
            print("✅ 视频转录成功!")
            print(f"   处理时间: {result['data'].get('processing_time', 'N/A')}ms")
            print(f"   转录文本长度: {len(result['data'].get('original_text', ''))} 字符")
            print(f"   场景数量: {len(result['data']['script'].get('scenes', []))}")
        else:
            print("❌ 转录失败:", result.get("error", {}).get("message"))
    else:
        print(f"❌ HTTP 错误 {response.status_code}")
        print(f"   响应: {response.text[:200]}...")
except Exception as e:
    print(f"❌ 请求失败: {str(e)}")

# 测试 3: 安全防护
print("\n3️⃣ 测试 SSRF 防护...")
data = {
    "video_url": "http://localhost:8080/hack.mp4"
}

try:
    response = requests.post(
        f"{BASE_URL}/api/video/transcribe", 
        headers=headers,
        json=data,
        verify=False,
        timeout=10
    )
    
    result = response.json()
    if "不允许访问内网地址" in str(result):
        print("✅ SSRF 防护正常!")
    else:
        print("⚠️  SSRF 防护可能有问题")
        print(f"   响应: {result}")
except Exception as e:
    print(f"测试出错: {str(e)}")

# 测试 4: 认证
print("\n4️⃣ 测试认证机制...")
headers_no_auth = {
    "Content-Type": "application/json"
}
data = {
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}

try:
    response = requests.post(
        f"{BASE_URL}/api/video/transcribe", 
        headers=headers_no_auth,
        json=data,
        verify=False,
        timeout=10
    )
    
    if response.status_code == 401:
        print("✅ 认证检查正常!")
    else:
        print("⚠️  认证可能有问题")
        print(f"   状态码: {response.status_code}")
except Exception as e:
    print(f"测试出错: {str(e)}")

print("\n" + "=" * 50)
print("📊 测试完成!")
print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")