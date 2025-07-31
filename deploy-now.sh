#!/bin/bash
# 部署修复版ASR到Cloudflare

echo "🚀 开始部署修复版Worker..."

# 检查是否安装了wrangler
if ! command -v wrangler &> /dev/null; then
    echo "📦 安装wrangler..."
    npm install -g wrangler
fi

# 登录检查
echo "🔐 检查Cloudflare登录状态..."
wrangler whoami || wrangler login

# 部署Worker
echo "📤 部署Worker到Cloudflare..."
wrangler deploy cloudflare-worker-fixed-asr.js --name jiaoben-api

# 测试部署
echo "🧪 测试部署..."
sleep 5
curl https://jiaoben-api.keating8500.workers.dev/api/test | jq .

echo "✅ 部署完成！"
echo "📌 在线地址: https://jiaoben-project.pages.dev/"
echo "🔧 Worker API: https://jiaoben-api.keating8500.workers.dev/"