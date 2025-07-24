#!/bin/bash

# 综合测试脚本 - Story 0.2 视频转文字编排服务
# 使用方法: ./comprehensive-test.sh [local|production]

# 设置颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果记录
TEST_RESULTS=()

# 辅助函数：执行测试
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_status="$3"
    local expected_content="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "\n${BLUE}[$TOTAL_TESTS] 测试: $test_name${NC}"
    
    # 执行命令并捕获响应
    response=$(eval "$test_command" 2>&1)
    status=$?
    
    # 检查 HTTP 状态码
    if echo "$response" | grep -q "HTTP/[0-9.]* $expected_status"; then
        status_ok=true
    else
        status_ok=false
    fi
    
    # 检查响应内容
    if [ -n "$expected_content" ]; then
        if echo "$response" | grep -q "$expected_content"; then
            content_ok=true
        else
            content_ok=false
        fi
    else
        content_ok=true
    fi
    
    # 判断测试结果
    if [ "$status_ok" = true ] && [ "$content_ok" = true ]; then
        echo -e "${GREEN}✓ 通过${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✓ $test_name")
    else
        echo -e "${RED}✗ 失败${NC}"
        echo "响应内容: $response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("✗ $test_name")
    fi
}

# 辅助函数：测量响应时间
measure_time() {
    local start=$(date +%s)
    eval "$1"
    local end=$(date +%s)
    echo $((end - start))
}

echo -e "\n${YELLOW}=== Story 0.2 综合测试开始 ===${NC}"
echo -e "时间: $(date)"
echo -e "API 地址: $BASE_URL"
echo -e "\n"

# 创建测试报告目录
REPORT_DIR="test-reports/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$REPORT_DIR"

# 1. 基础功能测试
echo -e "${YELLOW}一、基础功能测试${NC}"

# 1.1 健康检查
run_test "API健康检查" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' '$BASE_URL/api'" \
    "200" \
    "status.*ok"

# 1.2 正常视频处理 - 默认风格
run_test "视频处理-默认风格" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\", \"style\": \"default\"}'" \
    "200" \
    "success.*true"

# 1.3 幽默风格测试
run_test "视频处理-幽默风格" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\", \"style\": \"humorous\"}'" \
    "200" \
    "success.*true"

# 1.4 专业风格测试
run_test "视频处理-专业风格" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\", \"style\": \"professional\"}'" \
    "200" \
    "success.*true"

# 2. 安全测试
echo -e "\n${YELLOW}二、安全测试${NC}"

# 2.1 SSRF 防护 - localhost
run_test "SSRF防护-localhost" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"http://localhost:8080/video.mp4\"}'" \
    "400" \
    "不允许访问内网地址"

# 2.2 SSRF 防护 - 内网IP
run_test "SSRF防护-内网IP" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"http://192.168.1.1/video.mp4\"}'" \
    "400" \
    "不允许访问内网地址"

# 2.3 SSRF 防护 - 云服务元数据
run_test "SSRF防护-云服务元数据" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"http://169.254.169.254/latest/meta-data/\"}'" \
    "400" \
    "不允许访问该主机"

# 2.4 XSS 防护
run_test "XSS防护-style参数" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\", \"style\": \"<script>alert(1)</script>\"}'" \
    "400" \
    "style参数包含非法字符"

# 2.5 认证测试 - 无token
run_test "认证-缺少token" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -d '{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"}'" \
    "401" \
    "缺少Authorization头"

# 2.6 认证测试 - 短token
run_test "认证-token太短" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer short-token' \
        -d '{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"}'" \
    "401" \
    "Token长度至少为32字符"

# 3. 错误处理测试
echo -e "\n${YELLOW}三、错误处理测试${NC}"

# 3.1 无效URL
run_test "错误处理-无效URL" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"not-a-valid-url\"}'" \
    "400" \
    "URL格式无效"

# 3.2 不支持的协议
run_test "错误处理-FTP协议" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"ftp://example.com/video.mp4\"}'" \
    "400" \
    "仅支持 HTTP/HTTPS 协议"

# 3.3 缺少必需参数
run_test "错误处理-缺少video_url" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{}'" \
    "400" \
    "缺少必需的 video_url 参数"

# 3.4 无效的style参数
run_test "错误处理-无效style" \
    "curl -s -w '\nHTTP/%{http_version} %{http_code}' -X POST '$BASE_URL/api/video/transcribe' \
        -H 'Content-Type: application/json' \
        -H 'Authorization: Bearer $API_TOKEN' \
        -d '{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\", \"style\": \"invalid-style\"}'" \
    "400" \
    "无效的style参数"

# 4. 性能测试
echo -e "\n${YELLOW}四、性能测试${NC}"

# 4.1 响应时间测试
echo -e "\n${BLUE}测试: 响应时间测量${NC}"
time_taken=$(measure_time "curl -s -X POST '$BASE_URL/api/video/transcribe' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $API_TOKEN' \
    -d '{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"}'")

if [ "$time_taken" -lt 60 ]; then
    echo -e "${GREEN}✓ 通过 - 处理时间: ${time_taken}秒 (< 60秒)${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TEST_RESULTS+=("✓ 性能测试 - 响应时间 (${time_taken}秒)")
else
    echo -e "${RED}✗ 失败 - 处理时间: ${time_taken}秒 (> 60秒)${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TEST_RESULTS+=("✗ 性能测试 - 响应时间 (${time_taken}秒)")
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 4.2 并发请求测试
echo -e "\n${BLUE}测试: 并发请求处理${NC}"
echo "发送3个并发请求..."

# 记录开始时间
start_time=$(date +%s)

# 发送并发请求
for i in {1..3}; do
    curl -s -X POST "$BASE_URL/api/video/transcribe" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_TOKEN" \
        -d "{\"video_url\": \"https://www.youtube.com/watch?v=dQw4w9WgXcQ\", \"style\": \"default\"}" \
        -o "$REPORT_DIR/concurrent_$i.json" &
done

# 等待所有请求完成
wait

# 记录结束时间
end_time=$(date +%s)
concurrent_time=$((end_time - start_time))

# 检查结果
success_count=0
for i in {1..3}; do
    if grep -q '"success":true' "$REPORT_DIR/concurrent_$i.json" 2>/dev/null; then
        success_count=$((success_count + 1))
    fi
done

if [ "$success_count" -eq 3 ]; then
    echo -e "${GREEN}✓ 通过 - 3个并发请求都成功 (总时间: ${concurrent_time}秒)${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TEST_RESULTS+=("✓ 并发测试 - 3个请求都成功")
else
    echo -e "${RED}✗ 失败 - 只有 $success_count/3 个请求成功${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TEST_RESULTS+=("✗ 并发测试 - 只有 $success_count/3 个请求成功")
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 5. 资源清理验证
echo -e "\n${YELLOW}五、资源清理验证${NC}"

# 5.1 临时文件检查（仅本地环境）
if [ "$ENV" = "local" ]; then
    echo -e "\n${BLUE}测试: 临时文件清理${NC}"
    
    # 统计测试前的临时文件
    before_count=$(ls -la /tmp/ 2>/dev/null | grep -E "\.mp4|\.mp3" | wc -l | tr -d ' ')
    
    # 执行一个请求
    curl -s -X POST "$BASE_URL/api/video/transcribe" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $API_TOKEN" \
        -d '{"video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' > /dev/null
    
    # 等待清理完成
    sleep 2
    
    # 统计测试后的临时文件
    after_count=$(ls -la /tmp/ 2>/dev/null | grep -E "\.mp4|\.mp3" | wc -l | tr -d ' ')
    
    if [ "$before_count" -eq "$after_count" ]; then
        echo -e "${GREEN}✓ 通过 - 临时文件已清理${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✓ 资源清理 - 临时文件")
    else
        echo -e "${RED}✗ 失败 - 发现未清理的临时文件${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("✗ 资源清理 - 临时文件")
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

# 6. 生成测试报告
echo -e "\n${YELLOW}=== 测试报告 ===${NC}"
echo -e "测试时间: $(date)"
echo -e "测试环境: $ENV"
echo -e "API 地址: $BASE_URL"
echo -e "\n测试统计:"
echo -e "  总测试数: $TOTAL_TESTS"
echo -e "  ${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "  ${RED}失败: $FAILED_TESTS${NC}"
echo -e "  通过率: $(awk "BEGIN {printf \"%.1f\", $PASSED_TESTS/$TOTAL_TESTS*100}")%"

# 保存报告到文件
{
    echo "# Story 0.2 测试报告"
    echo ""
    echo "- 测试时间: $(date)"
    echo "- 测试环境: $ENV"
    echo "- API 地址: $BASE_URL"
    echo ""
    echo "## 测试结果"
    echo ""
    echo "| 指标 | 数值 |"
    echo "|------|------|"
    echo "| 总测试数 | $TOTAL_TESTS |"
    echo "| 通过 | $PASSED_TESTS |"
    echo "| 失败 | $FAILED_TESTS |"
    echo "| 通过率 | $(awk "BEGIN {printf \"%.1f\", $PASSED_TESTS/$TOTAL_TESTS*100}")% |"
    echo ""
    echo "## 详细结果"
    echo ""
    for result in "${TEST_RESULTS[@]}"; do
        echo "- $result"
    done
} > "$REPORT_DIR/test_report.md"

echo -e "\n详细测试结果:"
for result in "${TEST_RESULTS[@]}"; do
    echo "  $result"
done

echo -e "\n${YELLOW}测试报告已保存到: $REPORT_DIR/test_report.md${NC}"

# 7. 部署建议
echo -e "\n${YELLOW}=== 部署建议 ===${NC}"
if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！可以安全部署到生产环境。${NC}"
    echo -e "\n部署步骤:"
    echo -e "1. git add -A"
    echo -e "2. git commit -m \"test: 完成 Story 0.2 手工测试，所有测试通过\""
    echo -e "3. git push origin main"
    echo -e "4. 等待 Vercel 自动部署"
    echo -e "5. 在生产环境再次运行: ./comprehensive-test.sh production"
else
    echo -e "${RED}⚠️  有 $FAILED_TESTS 个测试失败，建议修复后再部署。${NC}"
    echo -e "\n请检查失败的测试并修复相关问题。"
fi

# 返回测试状态
exit $FAILED_TESTS