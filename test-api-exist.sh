#!/bin/bash

echo "测试 API 端点是否存在..."
echo ""

# 测试 GET 请求（应该返回 405 Method Not Allowed）
echo "1. 测试 GET 请求:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" \
  https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple

echo ""
echo "2. 测试 OPTIONS 请求:"
curl -s -o /dev/null -w "状态码: %{http_code}\n" \
  -X OPTIONS \
  https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple

echo ""
echo "3. 测试 POST 请求（无认证）:"
curl -s -w "\n状态码: %{http_code}\n" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple | tail -1

echo ""
echo "4. 测试 POST 请求（有认证）:"
response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-api-key-123" \
  -d '{"mixedText": "测试 https://v.douyin.com/test/"}' \
  https://jiaoben-7jx4.vercel.app/api/video/transcribe-v3-simple)

http_code=$(echo "$response" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
body=$(echo "$response" | sed 's/HTTP_CODE:[0-9]*$//')

echo "状态码: $http_code"
echo "响应内容:"
echo "$body" | head -20

echo ""
echo "说明:"
echo "- 404: API 端点不存在"
echo "- 405: API 存在但方法不允许"
echo "- 401: API 存在但需要认证"
echo "- 200: API 正常工作"