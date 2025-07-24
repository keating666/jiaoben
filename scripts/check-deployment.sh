#!/bin/bash

echo "🔍 检查 Vercel 部署状态"
echo "========================"
echo ""

URL="https://jiaoben-7jx4.vercel.app"

# 检查 API
echo "1. 检查 API 状态..."
api_response=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api")
if [ "$api_response" = "200" ]; then
    echo "✅ API 在线 (HTTP $api_response)"
else
    echo "❌ API 离线 (HTTP $api_response)"
fi

# 检查主页
echo ""
echo "2. 检查主页..."
home_response=$(curl -s -o /dev/null -w "%{http_code}" "$URL/")
if [ "$home_response" = "200" ]; then
    echo "✅ 主页可访问 (HTTP $home_response)"
else
    echo "❌ 主页不可访问 (HTTP $home_response)"
fi

# 检查测试页面
echo ""
echo "3. 检查测试页面..."
test_response=$(curl -s -o /dev/null -w "%{http_code}" "$URL/vercel-test.html")
if [ "$test_response" = "200" ]; then
    echo "✅ 测试页面可访问 (HTTP $test_response)"
else
    echo "❌ 测试页面不可访问 (HTTP $test_response)"
fi

echo ""
echo "========================"
echo "如果看到 ❌，请等待 1-2 分钟后再试"