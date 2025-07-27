#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试配置
API_TOKEN="test-api-key-123"
LOCAL_URL="http://localhost:3001/api/video/transcribe-v3"
VERCEL_URL="https://jiaoben.vercel.app/api/video/transcribe-v3"

echo -e "${BLUE}=== Transcribe V3 快速测试 ===${NC}"
echo

# 选择测试环境
if [ "$1" == "vercel" ]; then
    TEST_URL=$VERCEL_URL
    echo -e "${YELLOW}测试环境: Vercel 部署${NC}"
else
    TEST_URL=$LOCAL_URL
    echo -e "${YELLOW}测试环境: 本地开发${NC}"
fi

echo "测试 URL: $TEST_URL"
echo

# 测试 1: 基础功能测试
echo -e "${BLUE}测试 1: 基础功能测试${NC}"
echo "发送请求..."

response=$(curl -s -w "\n%{http_code}" -X POST "$TEST_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{
    "mixedText": "看这个视频 https://v.douyin.com/iRyLb8kf/ 太好笑了",
    "style": "humorous"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "HTTP 状态码: $http_code"

if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✅ 测试通过${NC}"
    echo "响应内容:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo -e "${RED}❌ 测试失败${NC}"
    echo "错误响应:"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
fi

echo
echo -e "${BLUE}=== 测试完成 ===${NC}"
echo
echo "提示："
echo "1. 使用 './quick-test-v3.sh' 测试本地环境"
echo "2. 使用 './quick-test-v3.sh vercel' 测试 Vercel 部署"
echo "3. 确保本地测试服务器正在运行 (端口 3001)"