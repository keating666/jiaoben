#!/bin/bash
# Cloudflare 统一部署脚本
# 一键部署 Workers + Pages + 验证

set -e  # 遇到错误立即退出

echo "🚀 开始 Cloudflare 统一部署..."
echo "=====================================+"

# 1. 部署 Workers (API后端)
echo "📡 部署 Workers..."
wrangler deploy
if [ $? -eq 0 ]; then
    echo "✅ Workers 部署成功"
else
    echo "❌ Workers 部署失败"
    exit 1
fi

# 2. 等待 Workers 生效
echo "⏳ 等待 Workers 生效..."
sleep 5

# 3. 验证 Workers API
echo "🔍 验证 Workers API..."
API_URL="https://jiaoben-api.keating8500.workers.dev/api/test"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")
if [ "$RESPONSE" = "200" ]; then
    echo "✅ Workers API 验证通过"
else
    echo "❌ Workers API 验证失败 (HTTP: $RESPONSE)"
    exit 1
fi

# 4. 提交并推送到 GitHub (触发 Pages 部署)
echo "📄 部署 Pages..."
git add .
git commit -m "deploy: 统一部署 $(date '+%Y-%m-%d %H:%M:%S')" || echo "无新变更"
git push origin main

# 5. 等待 Pages 部署
echo "⏳ 等待 Pages 部署完成..."
sleep 30

# 6. 验证 Pages 部署
echo "🔍 验证 Pages 部署..."
PAGES_URL="https://jiaoben-project.pages.dev"
PAGES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL")
if [ "$PAGES_RESPONSE" = "200" ]; then
    echo "✅ Pages 部署验证通过"
else
    echo "⚠️ Pages 可能还在部署中 (HTTP: $PAGES_RESPONSE)"
fi

# 7. 清除 Cloudflare 缓存（可选）
echo "🧹 清除缓存..."
# 注意：需要配置 CLOUDFLARE_ZONE_ID 和 CLOUDFLARE_API_TOKEN
if [ -n "$CLOUDFLARE_ZONE_ID" ] && [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
         -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
         -H "Content-Type: application/json" \
         --data '{"purge_everything":true}' > /dev/null
    echo "✅ 缓存清除完成"
else
    echo "ℹ️ 跳过缓存清除（未配置 CLOUDFLARE_ZONE_ID 或 CLOUDFLARE_API_TOKEN）"
fi

echo "=====================================+"
echo "🎉 部署完成！"
echo ""
echo "📍 访问地址："
echo "   - API: https://jiaoben-api.keating8500.workers.dev"
echo "   - 页面: https://jiaoben-project.pages.dev"
echo ""
echo "💡 如果页面未更新，请等待2-3分钟后重试"