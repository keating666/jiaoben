#!/bin/bash

# 快速测试脚本 - 5分钟内完成关键测试
# 使用方法: ./quick-test.sh

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
BASE_URL="http://localhost:3000"
API_TOKEN="test-token-1234567890123456789012345678"
TEST_VIDEO="https://www.youtube.com/watch?v=dQw4w9WgXcQ"

echo -e "${YELLOW}=== 快速测试开始 ===${NC}"
echo -e "时间: $(date)\n"

# 测试计数
TESTS=0
PASSED=0

# 测试函数
test_case() {
    local name="$1"
    local cmd="$2"
    local expect="$3"
    
    TESTS=$((TESTS + 1))
    echo -e "${BLUE}[$TESTS] $name${NC}"
    
    result=$(eval "$cmd" 2>&1)
    
    if echo "$result" | grep -q "$expect"; then
        echo -e "${GREEN}✓ 通过${NC}\n"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ 失败${NC}"
        echo -e "期望: $expect"
        echo -e "实际: $(echo "$result" | head -5)...\n"
    fi
}

# 1. API 健康检查
test_case "API健康检查" \
    "curl -s http://localhost:3000/api" \
    "status"

# 2. 基础功能测试
test_case "视频转录-默认风格" \
    "curl -s -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"$TEST_VIDEO\"}' | jq '.success'" \
    "true"

# 3. 安全测试
test_case "SSRF防护测试" \
    "curl -s -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"http://localhost/video\"}' | jq -r '.error.message'" \
    "不允许访问内网地址"

test_case "XSS防护测试" \
    "curl -s -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"$TEST_VIDEO\", \"style\": \"<script>alert(1)</script>\"}' | jq -r '.error.message'" \
    "style参数包含非法字符"

test_case "认证测试" \
    "curl -s -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -d '{\"video_url\": \"$TEST_VIDEO\"}' | jq -r '.error.message'" \
    "缺少Authorization头"

# 4. 错误处理测试
test_case "无效URL测试" \
    "curl -s -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"not-a-url\"}' | jq -r '.error.message'" \
    "URL格式无效"

# 5. 并发测试
echo -e "${BLUE}[7] 并发请求测试${NC}"
echo "发送3个并发请求..."
success_count=0
for i in {1..3}; do
    if curl -s -X POST "$BASE_URL/api/video/transcribe" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_TOKEN" \
        -d "{\"video_url\": \"$TEST_VIDEO\"}" | grep -q '"success":true'; then
        success_count=$((success_count + 1))
    fi &
done
wait

TESTS=$((TESTS + 1))
if [ "$success_count" -eq 3 ]; then
    echo -e "${GREEN}✓ 通过 - 3个请求都成功${NC}\n"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ 失败 - 只有 $success_count/3 成功${NC}\n"
fi

# 测试总结
echo -e "${YELLOW}=== 测试总结 ===${NC}"
echo -e "总测试: $TESTS"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$((TESTS - PASSED))${NC}"
echo -e "通过率: $(awk "BEGIN {printf \"%.0f\", $PASSED/$TESTS*100}")%"

if [ "$PASSED" -eq "$TESTS" ]; then
    echo -e "\n${GREEN}✅ 所有测试通过！可以部署。${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  有测试失败，请检查后再部署。${NC}"
    exit 1
fi