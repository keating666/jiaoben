#!/bin/bash

# API 测试脚本
# 使用方法: ./test-api.sh [local|production]

# 设置颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 设置环境
ENV=${1:-local}
if [ "$ENV" = "local" ]; then
    BASE_URL="http://localhost:3000"
    echo -e "${YELLOW}测试环境: 本地开发${NC}"
else
    BASE_URL="https://your-vercel-app.vercel.app"
    echo -e "${YELLOW}测试环境: 生产环境${NC}"
fi

# 测试 token（请替换为实际 token）
API_TOKEN="test-token-1234567890123456789012345678"

# 测试视频 URL
VIDEO_URL_SHORT="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
VIDEO_URL_LONG="https://www.youtube.com/watch?v=LONG_VIDEO_ID"

echo -e "\n${YELLOW}开始 API 测试...${NC}\n"

# 测试 1: 基础 API 健康检查
echo -e "${YELLOW}测试 1: API 健康检查${NC}"
curl -s "$BASE_URL/api" | jq '.' || echo -e "${RED}API 健康检查失败${NC}"
echo -e "\n"

# 测试 2: 成功案例 - 默认样式
echo -e "${YELLOW}测试 2: 视频转录 - 默认样式${NC}"
response=$(curl -s -X POST "$BASE_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d "{\"url\": \"$VIDEO_URL_SHORT\"}")

if echo "$response" | jq -e '.success' > /dev/null; then
    echo -e "${GREEN}✓ 测试通过${NC}"
    echo "$response" | jq '.data.metadata'
else
    echo -e "${RED}✗ 测试失败${NC}"
    echo "$response" | jq '.'
fi
echo -e "\n"

# 测试 3: 样式参数测试
echo -e "${YELLOW}测试 3: 视频转录 - 幽默样式${NC}"
response=$(curl -s -X POST "$BASE_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d "{\"url\": \"$VIDEO_URL_SHORT\", \"style\": \"humorous\"}")

if echo "$response" | jq -e '.success' > /dev/null; then
    echo -e "${GREEN}✓ 测试通过${NC}"
    echo "脚本标题: $(echo "$response" | jq -r '.data.script.title')"
else
    echo -e "${RED}✗ 测试失败${NC}"
    echo "$response" | jq '.'
fi
echo -e "\n"

# 测试 4: 错误处理 - 无效 URL
echo -e "${YELLOW}测试 4: 错误处理 - 无效 URL${NC}"
response=$(curl -s -X POST "$BASE_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"url": "not-a-valid-url"}')

if echo "$response" | jq -e '.error' > /dev/null; then
    echo -e "${GREEN}✓ 错误处理正确${NC}"
    echo "错误信息: $(echo "$response" | jq -r '.error')"
else
    echo -e "${RED}✗ 错误处理失败${NC}"
    echo "$response" | jq '.'
fi
echo -e "\n"

# 测试 5: 安全测试 - SSRF
echo -e "${YELLOW}测试 5: 安全测试 - SSRF 防护${NC}"
response=$(curl -s -X POST "$BASE_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"url": "http://localhost:8080/admin"}')

if echo "$response" | jq -e '.error' > /dev/null; then
    echo -e "${GREEN}✓ SSRF 防护有效${NC}"
    echo "错误信息: $(echo "$response" | jq -r '.error')"
else
    echo -e "${RED}✗ SSRF 防护失败${NC}"
    echo "$response" | jq '.'
fi
echo -e "\n"

# 测试 6: 认证测试
echo -e "${YELLOW}测试 6: 认证测试 - 缺少 token${NC}"
response=$(curl -s -X POST "$BASE_URL/api/video/transcribe" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$VIDEO_URL_SHORT\"}")

if [ "$(echo "$response" | jq -r '.statusCode')" = "401" ]; then
    echo -e "${GREEN}✓ 认证检查正确${NC}"
    echo "错误信息: $(echo "$response" | jq -r '.error')"
else
    echo -e "${RED}✗ 认证检查失败${NC}"
    echo "$response" | jq '.'
fi
echo -e "\n"

# 测试总结
echo -e "${YELLOW}=== 测试总结 ===${NC}"
echo -e "基础 URL: $BASE_URL"
echo -e "测试时间: $(date)"
echo -e "\n${GREEN}测试完成！${NC}"