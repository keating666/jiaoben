#!/bin/bash

echo "🔍 测试 API 状态..."
echo ""

# 测试健康检查
echo "1️⃣ 测试健康检查端点..."
curl -s https://jiaoben-7jx4.vercel.app/api | jq . || echo "响应: $(curl -s https://jiaoben-7jx4.vercel.app/api)"

echo ""
echo "---"
echo ""

# 测试完整头部信息
echo "2️⃣ 查看完整响应头..."
curl -I https://jiaoben-7jx4.vercel.app/api

echo ""
echo "---"
echo ""

# 测试 transcribe 端点（无认证）
echo "3️⃣ 测试 transcribe 端点（应返回 401）..."
curl -s -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "test"}' | jq . || echo "原始响应: $(curl -s -X POST https://jiaoben-7jx4.vercel.app/api/video/transcribe -H "Content-Type: application/json" -d '{"videoUrl": "test"}')"

echo ""
echo "---"
echo ""

# 测试 OPTIONS 请求（CORS）
echo "4️⃣ 测试 CORS（OPTIONS 请求）..."
curl -X OPTIONS https://jiaoben-7jx4.vercel.app/api/video/transcribe \
  -H "Origin: https://jiaoben-7jx4.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  -v 2>&1 | grep -E "(< HTTP|< Access-Control)"