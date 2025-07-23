# GitHub Secrets 配置指南

本文档说明了 CI/CD 流程所需的 GitHub Secrets 配置。

## 必需的 Secrets

### 1. Vercel 相关

- **`VERCEL_TOKEN`** (必需)
  - 获取方式: [Vercel Dashboard](https://vercel.com/account/tokens) → Create Token
  - 权限: Full Access
  - 用途: 部署到 Vercel

- **`VERCEL_ORG_ID`** (必需)
  - 获取方式: Vercel Dashboard → Settings → General → Your ID
  - 用途: 标识 Vercel 组织

- **`VERCEL_PROJECT_ID`** (必需)
  - 获取方式: Vercel Dashboard → 选择项目 → Settings → General → Project ID
  - 用途: 标识具体项目

### 2. API 测试密钥

用于 CI 测试的 API 密钥（建议使用专门的测试账号）:

- **`TEST_MINIMAX_API_KEY`**
- **`TEST_MINIMAX_GROUP_ID`**
- **`TEST_TONGYI_API_KEY`**
- **`TEST_IFLYTEK_API_KEY`**
- **`TEST_IFLYTEK_APP_ID`**
- **`TEST_IFLYTEK_API_SECRET`**

### 3. 监控用密钥

用于定时健康检查的 API 密钥（建议使用低配额的监控账号）:

- **`MONITOR_MINIMAX_API_KEY`**
- **`MONITOR_TONGYI_API_KEY`**
- **`MONITOR_IFLYTEK_API_KEY`**

### 4. 可选的 Secrets

- **`SLACK_WEBHOOK`**
  - 用途: 发送 Slack 通知
  - 获取: Slack App → Incoming Webhooks

- **`CLOUDFLARE_ZONE_ID`**
  - 用途: 清理 CDN 缓存
  - 获取: Cloudflare Dashboard → Zone ID

- **`CLOUDFLARE_API_TOKEN`**
  - 用途: Cloudflare API 访问
  - 权限: Zone:Cache Purge

## 设置步骤

1. 进入 GitHub 仓库页面
2. 点击 Settings → Secrets and variables → Actions
3. 点击 "New repository secret"
4. 输入 Name 和 Value
5. 点击 "Add secret"

## 安全建议

1. **使用最小权限原则**
   - 测试用的 API 密钥应该有配额限制
   - 监控用的密钥只需要最基本的调用权限

2. **定期轮换密钥**
   - 建议每 3 个月更换一次密钥
   - 保持密钥更新记录

3. **环境隔离**
   - 生产环境密钥不要用于测试
   - 不同环境使用不同的密钥

4. **访问控制**
   - 限制能够访问 Secrets 的人员
   - 使用 GitHub 的环境保护规则

## 故障排查

### 常见问题

1. **部署失败: "Error: Missing required environment variable"**
   - 检查是否设置了所有必需的 Vercel Secrets

2. **测试失败: "401 Unauthorized"**
   - 检查 API 密钥是否正确
   - 确认密钥没有过期

3. **健康检查失败**
   - 检查监控用密钥是否有效
   - 确认 API 服务商没有维护

### 验证 Secrets

可以通过以下 workflow 验证 Secrets 是否正确设置:

```yaml
name: Verify Secrets

on:
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Check Vercel Secrets
        run: |
          if [ -z "${{ secrets.VERCEL_TOKEN }}" ]; then
            echo "❌ VERCEL_TOKEN is not set"
            exit 1
          else
            echo "✅ VERCEL_TOKEN is set"
          fi
          
      - name: Check API Secrets
        run: |
          # 检查其他 secrets...
          echo "✅ All secrets verified"
```

## 更新记录

| 日期 | 更新内容 | 更新人 |
|------|---------|--------|
| 2025-01-23 | 初始文档创建 | Quinn |

---

**注意**: 本文档包含敏感信息配置说明，请勿公开分享。