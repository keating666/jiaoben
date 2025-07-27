#!/bin/bash

echo "添加缺失的环境变量到 .env 文件..."

ENV_FILE="/Users/keating/Desktop/appdev/jiaoben/tech-validation/.env"

# 检查文件是否存在
if [ ! -f "$ENV_FILE" ]; then
    echo "错误: .env 文件不存在"
    exit 1
fi

# 备份原文件
cp "$ENV_FILE" "$ENV_FILE.backup"
echo "已创建备份: $ENV_FILE.backup"

# 添加 TikHub 配置
echo "" >> "$ENV_FILE"
echo "# =================================" >> "$ENV_FILE"
echo "# TikHub API 配置" >> "$ENV_FILE"
echo "# =================================" >> "$ENV_FILE"
echo "# 用途：抖音视频地址解析" >> "$ENV_FILE"
echo "# 官网：https://tikhub.io/" >> "$ENV_FILE"
echo "# 文档：https://tikhub.io/docs" >> "$ENV_FILE"
echo "# 注意：需要注册账号并购买 API Token" >> "$ENV_FILE"
echo "TIKHUB_API_TOKEN=your_tikhub_api_token_here" >> "$ENV_FILE"
echo "TIKHUB_API_BASE_URL=https://api.tikhub.io" >> "$ENV_FILE"

# 添加云猫转码配置
echo "" >> "$ENV_FILE"
echo "# =================================" >> "$ENV_FILE"
echo "# 云猫转码 API 配置" >> "$ENV_FILE"
echo "# =================================" >> "$ENV_FILE"
echo "# 用途：视频转文字服务商（支持直接处理视频URL）" >> "$ENV_FILE"
echo "# 官网：https://yunmaovideo.com/" >> "$ENV_FILE"
echo "# 特点：支持多语言、对话模式、准确率高达98%" >> "$ENV_FILE"
echo "# 注意：需要注册账号并获取 API 密钥" >> "$ENV_FILE"
echo "YUNMAO_API_KEY=your_yunmao_api_key_here" >> "$ENV_FILE"
echo "YUNMAO_API_SECRET=your_yunmao_api_secret_here" >> "$ENV_FILE"
echo "YUNMAO_API_BASE_URL=https://api.yunmaovideo.com/v1" >> "$ENV_FILE"

echo ""
echo "✅ 已添加环境变量模板到 .env 文件"
echo ""
echo "请编辑 $ENV_FILE 文件，将以下内容替换为实际的 API 密钥："
echo "1. TIKHUB_API_TOKEN - 从 https://tikhub.io/ 获取"
echo "2. YUNMAO_API_KEY 和 YUNMAO_API_SECRET - 从 https://yunmaovideo.com/ 获取"
echo ""
echo "使用以下命令编辑文件："
echo "nano $ENV_FILE"
echo "或"
echo "vim $ENV_FILE"