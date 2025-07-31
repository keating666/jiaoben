#!/bin/bash

# 测试完整功能的脚本
WORKER_URL="https://jiaoben-api.keating8500.workers.dev"

# 测试用的抖音链接（可以换成任何抖音链接）
DOUYIN_URL="https://v.douyin.com/iYqnFyCV/ 复制此链接，打开Dou音搜索，直接观看视频！"

echo "🧪 测试抖音视频分镜脚本生成..."
echo "📍 Worker URL: $WORKER_URL"
echo "🔗 测试链接: $DOUYIN_URL"
echo ""

# 发送请求
curl -X POST "$WORKER_URL/api/process" \
  -H "Content-Type: application/json" \
  -d "{\"douyinUrl\": \"$DOUYIN_URL\"}" \
  -w "\n\n⏱️ 总耗时: %{time_total}s\n" \
  | jq '.'

# 如果没有 jq，可以用这个版本：
# curl -X POST "$WORKER_URL/api/process" \
#   -H "Content-Type: application/json" \
#   -d "{\"douyinUrl\": \"$DOUYIN_URL\"}"