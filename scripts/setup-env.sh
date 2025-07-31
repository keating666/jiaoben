#!/bin/bash
# Cloudflare 环境变量统一管理脚本

echo "🔧 Cloudflare 环境变量配置向导"
echo "============================="

# 检查 wrangler 是否已登录
if ! wrangler whoami &>/dev/null; then
    echo "❌ 请先登录 wrangler: wrangler login"
    exit 1
fi

echo "💡 请输入以下环境变量（留空跳过）："
echo ""

# 收集环境变量
declare -A env_vars
env_vars["TENCENT_SECRET_ID"]="腾讯云 Secret ID"
env_vars["TENCENT_SECRET_KEY"]="腾讯云 Secret Key"
env_vars["TONGYI_API_KEY"]="通义千问 API Key"
env_vars["TIKHUB_API_TOKEN"]="TikHub API Token"

# 存储要设置的变量
declare -A to_set

for key in "${!env_vars[@]}"; do
    echo -n "${env_vars[$key]} ($key): "
    read -r value
    if [ -n "$value" ]; then
        to_set[$key]="$value"
    fi
done

echo ""
echo "📝 将要设置的环境变量："
for key in "${!to_set[@]}"; do
    echo "   - $key: ${to_set[$key]:0:8}..."
done

echo ""
read -p "确认设置这些环境变量？(y/N): " confirm
if [[ $confirm =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 正在设置环境变量..."
    
    for key in "${!to_set[@]}"; do
        echo "设置 $key..."
        echo "${to_set[$key]}" | wrangler secret put "$key"
        if [ $? -eq 0 ]; then
            echo "✅ $key 设置成功"
        else
            echo "❌ $key 设置失败"
        fi
    done
    
    echo ""
    echo "🎉 环境变量配置完成！"
    echo ""
    echo "💡 验证配置："
    echo "   运行: wrangler secret list"
else
    echo "❌ 已取消设置"
fi