#!/bin/bash

echo "启动 Transcribe V3 测试服务器..."
echo ""

# 切换到正确的目录
cd /Users/keating/Desktop/appdev/jiaoben

# 检查环境变量文件
if [ -f "tech-validation/.env" ]; then
    echo "✅ 找到 .env 文件"
else
    echo "❌ 未找到 tech-validation/.env 文件"
    echo "请先创建 .env 文件并配置必要的环境变量"
    exit 1
fi

# 启动服务器
echo ""
echo "启动服务器在端口 3001..."
npx ts-node api/video/test-transcribe-v3-local.ts