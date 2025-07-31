#!/bin/bash
# 设置环境变量脚本 - 避免每次部署后重复设置

echo "🔧 设置 Cloudflare Worker 环境变量..."
echo "请准备好您的密钥值"
echo ""

# TikHub Token
echo "1. 设置 TikHub Token"
read -p "请输入 TIKHUB_API_TOKEN: " TIKHUB_TOKEN
wrangler secret put TIKHUB_API_TOKEN --name jiaoben-api <<< "$TIKHUB_TOKEN"

# 阿里云配置
echo ""
echo "2. 设置阿里云 ASR 配置"
read -p "请输入 ALIYUN_ACCESS_KEY_ID: " ACCESS_KEY_ID
wrangler secret put ALIYUN_ACCESS_KEY_ID --name jiaoben-api <<< "$ACCESS_KEY_ID"

read -s -p "请输入 ALIYUN_ACCESS_KEY_SECRET (输入时不显示): " ACCESS_KEY_SECRET
echo ""
wrangler secret put ALIYUN_ACCESS_KEY_SECRET --name jiaoben-api <<< "$ACCESS_KEY_SECRET"

read -p "请输入 ALIYUN_APP_KEY: " APP_KEY
wrangler secret put ALIYUN_APP_KEY --name jiaoben-api <<< "$APP_KEY"

# 通义千问
echo ""
echo "3. 设置通义千问 API Key"
read -s -p "请输入 QWEN_API_KEY (输入时不显示): " QWEN_KEY
echo ""
wrangler secret put QWEN_API_KEY --name jiaoben-api <<< "$QWEN_KEY"

echo ""
echo "✅ 环境变量设置完成！"
echo ""
echo "验证配置..."
sleep 3
curl https://jiaoben-api.keating8500.workers.dev/api/test | jq .