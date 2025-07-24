#!/bin/bash

# 交互式测试脚本

echo "🎯 Vercel API 测试工具"
echo "========================"
echo ""

# 让用户输入 Vercel URL
echo "请输入您的 Vercel 应用 URL"
echo "例如: jiaoben-abc123.vercel.app"
echo -n "URL: "
read VERCEL_URL

# 如果用户没有输入 https://
if [[ ! "$VERCEL_URL" =~ ^https?:// ]]; then
    VERCEL_URL="https://$VERCEL_URL"
fi

echo ""
echo "正在测试: $VERCEL_URL"
echo ""

# API Token
TOKEN="test-token-1234567890123456789012345678"

# 测试 1: API 健康检查
echo "1️⃣  检查 API 是否在线..."
response=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$VERCEL_URL/api")
http_status=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)
body=$(echo "$response" | grep -v "HTTP_STATUS")

if [ "$http_status" = "200" ]; then
    echo "✅ API 在线！"
    echo "响应: $body"
else
    echo "❌ API 离线或 URL 错误"
    echo "HTTP 状态码: $http_status"
    echo "请检查 URL 是否正确"
    exit 1
fi

echo ""
echo "2️⃣  测试视频转录功能..."
echo "发送测试请求到: $VERCEL_URL/api/video/transcribe"

# 显示正在发送的请求
echo ""
echo "请求详情:"
echo "- Method: POST"
echo "- Headers: Authorization: Bearer test-token..."
echo "- Body: {\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"}"
echo ""

response=$(curl -s -X POST "$VERCEL_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }')

# 检查响应
if echo "$response" | grep -q "success.*true"; then
    echo "✅ 视频转录测试成功！"
    echo ""
    echo "响应预览:"
    echo "$response" | python3 -m json.tool 2>/dev/null | head -20 || echo "$response" | head -100
elif echo "$response" | grep -q "error"; then
    echo "❌ 视频转录失败"
    echo "错误信息:"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "❌ 未知响应"
    echo "$response"
fi

echo ""
echo "3️⃣  测试安全防护（SSRF）..."
response=$(curl -s -X POST "$VERCEL_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "video_url": "http://localhost:8080/hack.mp4"
  }')

if echo "$response" | grep -q "不允许访问内网地址"; then
    echo "✅ SSRF 防护正常工作！"
elif echo "$response" | grep -q "URL格式无效"; then
    echo "✅ URL 验证正常工作！"
else
    echo "⚠️  安全防护可能有问题"
    echo "响应: $response"
fi

echo ""
echo "4️⃣  测试认证..."
response=$(curl -s -X POST "$VERCEL_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -d '{
    "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }')

if echo "$response" | grep -q "缺少Authorization头\|UNAUTHORIZED"; then
    echo "✅ 认证检查正常！"
else
    echo "⚠️  认证可能有问题"
    echo "响应: $response"
fi

echo ""
echo "========================"
echo "📊 测试完成！"
echo ""
echo "如果所有测试都是 ✅，说明您的 API 工作正常！"
echo "如果有 ❌，请检查："
echo "1. 环境变量是否在 Vercel 中配置"
echo "2. 最新代码是否已部署"
echo ""
echo "查看 Vercel 日志: vercel logs"