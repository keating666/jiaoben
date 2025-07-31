#!/bin/bash

echo "🚀 强制部署到香港区域..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装，正在安装..."
    npm i -g vercel
fi

echo "📍 设置环境变量..."
export VERCEL_REGION=hkg1

echo "🔧 清理并重新部署..."
# 删除本地 Vercel 配置
rm -rf .vercel

echo "🌏 部署到香港 (hkg1)..."
vercel --prod --regions hkg1 --force

echo "✅ 部署命令已执行！"
echo ""
echo "如果还是部署到美国，请尝试："
echo "1. 在 Vercel Dashboard 删除项目"
echo "2. 重新导入项目"
echo "3. 导入时立即选择香港区域"