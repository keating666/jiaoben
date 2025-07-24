#!/bin/bash

# SSL 友好的测试脚本

echo "🎯 视频转文字 API 测试 (SSL 兼容版)"
echo "===================================="
echo ""

URL="https://jiaoben-7jx4.vercel.app"
TOKEN="test-token-1234567890123456789012345678"

# 测试 1: API 健康检查
echo "1️⃣  测试 API 健康检查..."
response=$(curl -k -s "$URL/api")
if echo "$response" | grep -q "status.*deployed"; then
    echo "✅ API 在线!"
    echo "   响应: $(echo "$response" | cut -c1-100)..."
else
    echo "❌ API 离线"
fi

echo ""
echo "2️⃣  测试视频转录..."
echo "   发送请求中（可能需要 30-60 秒）..."

response=$(curl -k -s -X POST "$URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "style": "default"
  }')

if echo "$response" | grep -q "success.*true"; then
    echo "✅ 视频转录成功!"
    # 提取一些关键信息
    if command -v python3 >/dev/null 2>&1; then
        echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if data.get('success'):
        print(f'   处理时间: {data[\"data\"].get(\"processing_time\", \"N/A\")}ms')
        print(f'   文本长度: {len(data[\"data\"].get(\"original_text\", \"\"))} 字符')
        print(f'   场景数: {len(data[\"data\"][\"script\"].get(\"scenes\", []))}')
except:
    print('   (详细信息解析失败，但请求成功)')
"
    fi
else
    echo "❌ 视频转录失败"
    echo "   响应: $(echo "$response" | cut -c1-200)..."
fi

echo ""
echo "3️⃣  测试安全防护..."
response=$(curl -k -s -X POST "$URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "video_url": "http://localhost:8080/hack.mp4"
  }')

if echo "$response" | grep -q "不允许访问内网地址"; then
    echo "✅ SSRF 防护正常!"
else
    echo "⚠️  SSRF 防护测试结果："
    echo "   $(echo "$response" | cut -c1-100)..."
fi

echo ""
echo "4️⃣  测试认证..."
response=$(curl -k -s -X POST "$URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }')

if echo "$response" | grep -q "缺少Authorization头\|UNAUTHORIZED\|401"; then
    echo "✅ 认证检查正常!"
else
    echo "⚠️  认证测试结果："
    echo "   $(echo "$response" | cut -c1-100)..."
fi

echo ""
echo "===================================="
echo "📊 测试总结"
echo ""
echo "如果看到多个 ✅，说明 API 工作正常！"
echo ""
echo "提示："
echo "- 视频转录可能需要 30-60 秒"
echo "- 如果超时，可能是视频处理时间较长"
echo "- 查看日志: vercel logs"