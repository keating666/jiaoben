# 故障排查指南

## 常见问题和解决方案

### 1. Git Push 失败

**错误**: `fatal: Authentication failed`

**解决方案**:
1. 确保使用个人访问令牌而不是密码
2. 重新设置远程 URL：
   ```bash
   git remote set-url origin https://YOUR_USERNAME:YOUR_TOKEN@github.com/YOUR_USERNAME/jiaoben.git
   ```

### 2. Vercel 部署失败

**错误**: `Error: Cannot find module`

**解决方案**:
1. 确保 Build Command 正确：
   ```
   cd tech-validation && npm install && npm run build
   ```
2. 检查 package.json 是否在正确位置

### 3. GitHub Actions 失败

**错误**: `Error: Missing required environment variable`

**解决方案**:
1. 检查是否添加了所有必需的 Secrets
2. Secret 名称必须完全匹配（区分大小写）

### 4. ESLint 错误

**错误**: `Parsing error: Cannot read file`

**解决方案**:
```bash
cd tech-validation
npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### 5. TypeScript 错误

**错误**: `Cannot find module 'xxx' or its corresponding type declarations`

**解决方案**:
```bash
cd tech-validation
npm install
npm install --save-dev @types/node
```

## 如何查看错误详情

### GitHub Actions 日志
1. 进入仓库 → Actions
2. 点击失败的 workflow
3. 点击失败的 job
4. 查看详细错误信息

### Vercel 部署日志
1. Vercel Dashboard → 项目
2. 点击 "View Function Logs" 或 "View Build Logs"
3. 查看错误详情

## 需要帮助？

1. **检查文档**：重新阅读设置指南
2. **搜索错误**：复制错误信息到 Google
3. **查看示例**：参考其他成功的项目
4. **寻求帮助**：在 GitHub Issues 提问