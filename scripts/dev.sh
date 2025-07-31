#!/bin/bash
# Cloudflare 本地开发脚本
# 一键启动完整开发环境

echo "🛠️ 启动 Cloudflare 本地开发环境..."
echo "===================================="

# 检查依赖
if ! command -v wrangler &> /dev/null; then
    echo "❌ 请先安装 wrangler: npm install -g wrangler"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo "❌ 请先安装 Node.js"
    exit 1
fi

# 启动 Workers 开发服务器
echo "📡 启动 Workers 开发服务器..."
wrangler dev --port 8787 &
WORKER_PID=$!

# 等待 Workers 启动
sleep 3

# 启动静态文件服务器（用于开发前端）
echo "📄 启动前端开发服务器..."
npx serve public -p 3000 &
SERVE_PID=$!

# 等待服务启动
sleep 2

echo "===================================="
echo "🎉 开发环境已启动！"
echo ""
echo "📍 访问地址："
echo "   - Workers API: http://localhost:8787"
echo "   - 前端页面: http://localhost:3000"
echo ""
echo "💡 开发提示："
echo "   - 修改 Workers 代码会自动重载"
echo "   - 修改前端代码需要刷新浏览器"
echo "   - 按 Ctrl+C 停止所有服务"
echo ""

# 等待用户中断
trap "echo '🛑 正在停止服务...'; kill $WORKER_PID $SERVE_PID 2>/dev/null; exit 0" INT
wait