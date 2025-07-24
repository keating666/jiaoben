#!/bin/bash

echo "🔧 修复 ESLint 错误..."

# 进入 tech-validation 目录
cd tech-validation

# 使用 ESLint 自动修复
echo "📝 运行 ESLint 自动修复..."
npm run lint -- --fix

# 显示剩余的错误
echo ""
echo "📊 剩余错误统计："
npm run lint 2>&1 | grep -E "error|warning" | wc -l

echo ""
echo "✅ 自动修复完成！"