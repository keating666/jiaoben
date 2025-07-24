# CI/CD 配置指南

## 概述
本项目使用 GitHub Actions 进行持续集成，使用 Vercel 进行自动部署。

## GitHub Actions 工作流

### 1. 测试工作流 (test.yml)
- **触发条件**: 推送到 main/develop 分支，或 PR 到 main
- **测试内容**:
  - TypeScript 编译检查
  - ESLint 代码规范检查
  - Jest 单元测试
  - 测试覆盖率报告
  - 构建验证

### 2. 部署工作流 (deploy.yml)
- **触发条件**: 推送到 main 分支
- **部署流程**:
  1. 运行完整测试套件
  2. 构建项目
  3. 部署到 Vercel 生产环境
  4. 运行冒烟测试

## Vercel 配置

### 1. 环境变量设置
在 Vercel 项目设置中配置以下环境变量：
- `MINIMAX_API_KEY`: MiniMax API 密钥
- `DASHSCOPE_API_KEY`: 通义千问 API 密钥

### 2. GitHub Secrets 配置
在 GitHub 仓库设置中添加以下 Secrets：
- `VERCEL_TOKEN`: Vercel 访问令牌
- `VERCEL_ORG_ID`: Vercel 组织 ID
- `VERCEL_PROJECT_ID`: Vercel 项目 ID

获取这些值的方法：
```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录 Vercel
vercel login

# 3. 在项目根目录链接 Vercel 项目
vercel link

# 4. 查看 .vercel/project.json 获取 ID
cat .vercel/project.json
```

### 3. 函数配置
在 `vercel.json` 中配置了以下函数超时：
- `/api/index.js`: 10 秒（默认 API）
- `/api/video/transcribe.ts`: 60 秒（视频处理）

## 本地开发

### 1. 环境准备
```bash
# 克隆仓库
git clone <repository-url>
cd jiaoben

# 安装依赖
cd tech-validation
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加 API 密钥
```

### 2. 运行测试
```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率
npm run test:coverage

# 运行特定测试文件
npm test -- security-validator.test.ts
```

### 3. 本地运行
```bash
# 开发模式
npm run dev

# 构建项目
npm run build

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

## 部署流程

### 自动部署
1. 创建功能分支进行开发
2. 提交代码并推送到 GitHub
3. 创建 PR 到 main 分支
4. CI 自动运行测试
5. 代码审查通过后合并
6. 自动部署到 Vercel

### 手动部署
```bash
# 使用 Vercel CLI 手动部署
vercel --prod
```

## 监控和日志

### 查看部署状态
1. GitHub Actions: 查看工作流运行状态
2. Vercel Dashboard: 查看部署历史和日志

### 查看函数日志
```bash
# 使用 Vercel CLI
vercel logs

# 或在 Vercel Dashboard 查看
```

## 故障排除

### 常见问题

1. **部署失败: 环境变量缺失**
   - 检查 Vercel 项目设置中的环境变量
   - 确保所有必需的 API 密钥都已配置

2. **测试失败: 超时**
   - 检查测试中的异步操作
   - 增加 Jest 超时时间

3. **构建失败: TypeScript 错误**
   - 本地运行 `npm run typecheck`
   - 修复所有类型错误

4. **函数超时**
   - 检查视频时长是否超过 60 秒
   - 优化处理逻辑

## 安全建议

1. **API 密钥管理**
   - 永远不要将密钥提交到代码库
   - 使用环境变量管理敏感信息
   - 定期轮换 API 密钥

2. **访问控制**
   - 限制 GitHub Secrets 访问权限
   - 使用最小权限原则

3. **监控告警**
   - 设置异常流量告警
   - 监控 API 使用配额