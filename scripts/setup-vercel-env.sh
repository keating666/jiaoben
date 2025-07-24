#!/bin/bash

# 设置 Vercel 环境变量的脚本
# 使用方法: ./scripts/setup-vercel-env.sh

echo "🔧 配置 Vercel 环境变量..."

# 读取 .env 文件中的配置
ENV_FILE="tech-validation/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ 找不到 $ENV_FILE 文件"
    exit 1
fi

echo "📋 从 $ENV_FILE 读取配置..."

# 设置 Vercel 环境变量
while IFS='=' read -r key value; do
    # 跳过注释和空行
    if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]] && [[ -n "$value" ]]; then
        # 移除引号
        value="${value%\"}"
        value="${value#\"}"
        
        echo "设置 $key"
        vercel env add "$key" production < <(echo "$value")
    fi
done < "$ENV_FILE"

echo "✅ 环境变量配置完成！"
echo ""
echo "📝 下一步："
echo "1. 运行 vercel --prod 部署到生产环境"
echo "2. 访问 https://jiaoben-7jx4.vercel.app/api-test-dashboard.html 进行测试"