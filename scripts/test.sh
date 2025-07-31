#!/bin/bash
# 快速测试部署状态

echo "🧪 测试 Cloudflare 部署状态..."
echo "============================="

# 测试 Workers API
echo "📡 测试 Workers API..."
API_URL="https://jiaoben-api.keating8500.workers.dev/api/test"
API_RESPONSE=$(curl -s "$API_URL")
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")

if [ "$API_CODE" = "200" ]; then
    echo "✅ Workers API 正常 (HTTP 200)"
    echo "   响应: $(echo "$API_RESPONSE" | jq -r '.message' 2>/dev/null || echo "$API_RESPONSE")"
else
    echo "❌ Workers API 异常 (HTTP $API_CODE)"
    echo "   响应: $API_RESPONSE"
fi

echo ""

# 测试 Pages
echo "📄 测试 Pages..."
PAGES_URL="https://jiaoben-project.pages.dev"
PAGES_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL")

if [ "$PAGES_CODE" = "200" ]; then
    echo "✅ Pages 正常 (HTTP 200)"
    
    # 检查是否是个性化版本
    CONTENT=$(curl -s "$PAGES_URL")
    if echo "$CONTENT" | grep -q "个性化设置"; then
        echo "✅ 个性化功能已部署"
    else
        echo "⚠️ 可能还是旧版本，请等待缓存更新"
    fi
else
    echo "❌ Pages 异常 (HTTP $PAGES_CODE)"
fi

echo ""

# 测试完整工作流程
echo "🔗 测试完整工作流程..."
if [ "$API_CODE" = "200" ] && [ "$PAGES_CODE" = "200" ]; then
    echo "✅ 系统运行正常"
    echo ""
    echo "📍 访问地址："
    echo "   - 主页: https://jiaoben-project.pages.dev"
    echo "   - API: https://jiaoben-api.keating8500.workers.dev"
else
    echo "❌ 系统存在问题，请检查部署状态"
fi

echo ""
echo "💡 如果页面显示异常，请："
echo "   1. 等待2-3分钟后重试"
echo "   2. 清除浏览器缓存 (Ctrl+F5)"
echo "   3. 检查 wrangler secret list"