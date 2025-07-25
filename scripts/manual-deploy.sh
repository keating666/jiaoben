#!/bin/bash

# 手动部署脚本 - 仅在紧急情况下使用

echo "🚀 开始手动部署到 Vercel..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装，正在安装..."
    npm install -g vercel
fi

# 检查是否在正确的目录
if [ ! -f "vercel.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 确认部署
echo "⚠️  警告：这将直接部署到生产环境！"
echo "建议先确保："
echo "1. 所有测试都通过"
echo "2. 代码已经过 review"
echo "3. 没有未提交的更改"
echo ""
read -p "确定要继续吗？(y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 部署已取消"
    exit 1
fi

# 检查 git 状态
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  警告：有未提交的更改"
    git status --short
    echo ""
    read -p "仍要继续吗？(y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 部署已取消"
        exit 1
    fi
fi

# 获取当前分支和提交
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMIT=$(git rev-parse --short HEAD)

echo "📋 部署信息："
echo "  分支: $BRANCH"
echo "  提交: $COMMIT"
echo ""

# 运行测试（可选）
echo "🧪 运行快速检查..."
cd tech-validation
npm run typecheck || { echo "❌ TypeScript 检查失败"; exit 1; }
npm run lint || { echo "❌ ESLint 检查失败"; exit 1; }
cd ..

# 部署到 Vercel
echo "🚀 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo ""
echo "📝 后续步骤："
echo "1. 访问 https://jiaoben-7jx4.vercel.app 验证部署"
echo "2. 检查 API: https://jiaoben-7jx4.vercel.app/api/ping"
echo "3. 测试页面: https://jiaoben-7jx4.vercel.app/video-transcribe-dashboard.html"