#!/bin/bash
# 安全测试脚本 - 只检查不部署

echo "🛡️ 安全测试模式 - 只检查不修改任何部署"
echo "======================================="

echo "📊 当前状态检查..."

# 1. 检查当前 Workers 状态
echo "📡 检查 Workers API..."
API_URL="https://jiaoben-api.keating8500.workers.dev/api/test"
API_RESPONSE=$(curl -s "$API_URL" 2>/dev/null)
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL" 2>/dev/null)

if [ "$API_CODE" = "200" ]; then
    echo "✅ Workers API 正常 (HTTP 200)"
else
    echo "❌ Workers API 异常 (HTTP $API_CODE)"
fi

# 2. 检查当前 Pages 状态
echo "📄 检查 Pages..."
PAGES_URL="https://jiaoben-project.pages.dev"
PAGES_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PAGES_URL" 2>/dev/null)

if [ "$PAGES_CODE" = "200" ]; then
    echo "✅ Pages 访问正常 (HTTP 200)"
    
    # 检查页面版本
    CONTENT=$(curl -s "$PAGES_URL" 2>/dev/null)
    if echo "$CONTENT" | grep -q "个性化设置"; then
        echo "✅ 检测到个性化版本"
    elif echo "$CONTENT" | grep -q "Story 0.2 Demo"; then
        echo "⚠️ 当前是 Story 0.2 Demo 版本（旧版本）"
    else
        echo "❓ 无法识别页面版本"
    fi
else
    echo "❌ Pages 访问异常 (HTTP $PAGES_CODE)"
fi

echo ""
echo "📂 本地文件检查..."

# 3. 检查本地文件状态
if [ -f "public/index.html" ]; then
    if grep -q "个性化设置" "public/index.html"; then
        echo "✅ 本地 index.html 是个性化版本"
    else
        echo "⚠️ 本地 index.html 可能是旧版本"
    fi
else
    echo "❌ 本地 index.html 不存在"
fi

if [ -f "public/index-original-backup.html" ]; then
    echo "✅ 备份文件存在"
else
    echo "⚠️ 备份文件不存在"
fi

if [ -f "src/cloudflare-worker-tencent-asr.js" ]; then
    echo "✅ Workers 源代码存在"
else
    echo "❌ Workers 源代码不存在"
fi

echo ""
echo "🔧 环境检查..."

# 4. 检查工具版本
if command -v wrangler &> /dev/null; then
    WRANGLER_VERSION=$(wrangler --version 2>/dev/null | head -1)
    echo "✅ wrangler: $WRANGLER_VERSION"
else
    echo "❌ wrangler 未安装"
fi

if command -v git &> /dev/null; then
    GIT_BRANCH=$(git branch --show-current 2>/dev/null)
    echo "✅ git: 当前分支 $GIT_BRANCH"
else
    echo "❌ git 未安装"
fi

echo ""
echo "💡 建议操作："
if [ "$PAGES_CODE" = "200" ] && echo "$CONTENT" | grep -q "Story 0.2 Demo"; then
    echo "   1. 当前页面工作正常但是旧版本"
    echo "   2. 个性化版本在本地但未部署成功"
    echo "   3. 建议先手动验证本地文件"
    echo "   4. 确认无误后再尝试部署个性化版本"
elif [ "$PAGES_CODE" = "200" ] && echo "$CONTENT" | grep -q "个性化设置"; then
    echo "   1. 个性化版本已成功部署"
    echo "   2. 可以安全使用优化脚本"
else
    echo "   1. 页面访问异常，需要排查问题"
    echo "   2. 不建议进行任何部署操作"
fi

echo ""
echo "🛡️ 安全测试完成 - 未修改任何部署状态"