#!/bin/bash

# 手工测试脚本
# 使用方法: ./scripts/manual-test.sh YOUR_API_TOKEN

API_BASE="https://jiaoben-7jx4.vercel.app/api"
API_TOKEN="${1:-test-token-12345678901234567890123456789012}"

echo "🧪 开始手工测试..."
echo "📍 API 地址: $API_BASE"
echo "🔑 API Token: ${API_TOKEN:0:10}..."
echo ""

# 1. 健康检查
echo "1️⃣ 测试 API 健康检查..."
echo "命令: curl -s $API_BASE"
curl -s "$API_BASE" | jq . || echo "❌ jq 未安装，显示原始响应："
curl -s "$API_BASE"
echo ""
echo "---"

# 2. 正常请求测试
echo ""
echo "2️⃣ 测试正常的视频转文字请求..."
echo "命令: curl -X POST $API_BASE/video/transcribe"
echo "注意：这个请求可能需要较长时间（30-60秒）"
read -p "按 Enter 继续..."

curl -X POST "$API_BASE/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "style": "default",
    "language": "zh"
  }' \
  -w "\n状态码: %{http_code}\n" | jq . || echo "响应可能不是 JSON 格式"

echo ""
echo "---"

# 3. 安全测试 - 内网地址
echo ""
echo "3️⃣ 测试安全验证 - 拒绝内网地址..."
curl -s -X POST "$API_BASE/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "videoUrl": "http://localhost:8080/video.mp4"
  }' \
  -w "\n状态码: %{http_code}\n" | jq .

echo ""
echo "---"

# 4. 认证测试 - 无 Token
echo ""
echo "4️⃣ 测试认证 - 无 Authorization 头..."
curl -s -X POST "$API_BASE/video/transcribe" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  }' \
  -w "\n状态码: %{http_code}\n" | jq .

echo ""
echo "---"

# 5. 参数验证 - 缺少必需参数
echo ""
echo "5️⃣ 测试参数验证 - 缺少 videoUrl..."
curl -s -X POST "$API_BASE/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{}' \
  -w "\n状态码: %{http_code}\n" | jq .

echo ""
echo "---"

# 6. 并发测试提示
echo ""
echo "6️⃣ 并发控制测试"
echo "请手动运行以下命令来测试并发限制："
echo ""
echo 'for i in {1..4}; do'
echo '  curl -X POST "'$API_BASE'/video/transcribe" \'
echo '    -H "Content-Type: application/json" \'
echo '    -H "Authorization: Bearer '$API_TOKEN'" \'
echo '    -d "{'
echo '      \"videoUrl\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\",'
echo '      \"sessionId\": \"test-$i\"'
echo '    }" &'
echo 'done'
echo 'wait'
echo ""

echo "✅ 基础测试完成！"
echo ""
echo "📝 测试总结："
echo "- API 健康检查：检查上面的输出"
echo "- 正常请求：检查是否返回转录结果"
echo "- 安全验证：应该返回 400 错误"
echo "- 认证测试：应该返回 401 错误"
echo "- 参数验证：应该返回 400 错误"
echo ""
echo "⚠️  注意事项："
echo "1. 如果视频转文字请求失败，可能是 yt-dlp 兼容性问题"
echo "2. 请检查每个测试的状态码是否符合预期"
echo "3. 并发测试需要手动执行上面提供的命令"