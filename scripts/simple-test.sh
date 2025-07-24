#!/bin/bash

# 超简单测试脚本 - 直接测试您的 Vercel 部署

echo "🚀 开始测试您的 Vercel 部署..."
echo ""

# 请替换这个 URL 为您的实际 Vercel URL
VERCEL_URL="https://jiaoben.vercel.app"  # <-- 请修改这里！

# 测试 API Token
TOKEN="test-token-1234567890123456789012345678"

echo "1️⃣ 测试 API 是否在线..."
curl -s "$VERCEL_URL/api" | grep -q "status" && echo "✅ API 在线" || echo "❌ API 离线"

echo ""
echo "2️⃣ 测试视频转录功能..."
response=$(curl -s -X POST "$VERCEL_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }')

if echo "$response" | grep -q "success.*true"; then
  echo "✅ 视频转录成功"
else
  echo "❌ 视频转录失败"
  echo "响应: $response"
fi

echo ""
echo "3️⃣ 测试安全防护..."
response=$(curl -s -X POST "$VERCEL_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "video_url": "http://localhost/hack"
  }')

if echo "$response" | grep -q "不允许访问内网地址"; then
  echo "✅ SSRF 防护正常"
else
  echo "❌ SSRF 防护失败"
fi

echo ""
echo "✅ 测试完成！"