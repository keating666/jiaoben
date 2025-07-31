#!/bin/bash
# 设置讯飞环境变量脚本

echo "🔧 设置讯飞语音识别环境变量..."
echo "请准备好您的讯飞密钥值"
echo ""

# 讯飞配置
echo "设置讯飞语音识别配置"
read -p "请输入 XUNFEI_APP_ID: " APP_ID
wrangler secret put XUNFEI_APP_ID --name jiaoben-api <<< "$APP_ID"

read -s -p "请输入 XUNFEI_API_SECRET (输入时不显示): " API_SECRET
echo ""
wrangler secret put XUNFEI_API_SECRET --name jiaoben-api <<< "$API_SECRET"

read -p "请输入 XUNFEI_API_KEY: " API_KEY
wrangler secret put XUNFEI_API_KEY --name jiaoben-api <<< "$API_KEY"

echo ""
echo "✅ 讯飞环境变量设置完成！"
echo ""
echo "验证配置..."
sleep 3
curl https://jiaoben-api.keating8500.workers.dev/api/test | jq .