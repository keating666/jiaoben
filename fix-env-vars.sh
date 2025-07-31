#!/bin/bash
# 修复环境变量问题

echo "🔧 设置Cloudflare Worker环境变量..."

# 设置所有必需的环境变量
echo "📝 设置TikHub Token..."
wrangler secret put TIKHUB_API_TOKEN --name jiaoben-api

echo "📝 设置阿里云 Access Key ID..."
wrangler secret put ALIYUN_ACCESS_KEY_ID --name jiaoben-api

echo "📝 设置阿里云 Access Key Secret..."
wrangler secret put ALIYUN_ACCESS_KEY_SECRET --name jiaoben-api

echo "📝 设置阿里云 App Key..."
wrangler secret put ALIYUN_APP_KEY --name jiaoben-api

echo "📝 设置通义千问 API Key..."
wrangler secret put QWEN_API_KEY --name jiaoben-api

echo "✅ 环境变量设置完成！"
echo "🧪 测试配置..."
sleep 5
curl https://jiaoben-api.keating8500.workers.dev/api/test | jq .