# CI/CD 配置说明

## 架构设计

我们采用 **CI 优先，部署跟随** 的策略：

1. **GitHub Actions CI** - 所有代码质量检查必须通过
2. **Vercel 部署** - 只有在 CI 通过后才能部署

## 配置步骤

### 1. 禁用 Vercel 自动部署

在 `vercel.json` 中添加：
```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

### 2. GitHub Actions 触发部署

`deploy-vercel.yml` 配置为只在 CI 成功后触发：
```yaml
if: |
  github.event_name == 'workflow_run' && 
  github.event.workflow_run.conclusion == 'success'
```

### 3. 手动部署（紧急情况）

如需紧急部署，可以：
1. 在 Vercel Dashboard 手动触发
2. 使用 Vercel CLI: `vercel --prod`
3. 触发 workflow_dispatch

## 流程图

```
Push to main
    ↓
GitHub CI/CD Pipeline
    ├─ Code Quality Check ✓
    ├─ Unit Tests ✓
    ├─ Build Check ✓
    └─ Security Scan ✓
         ↓
    All Passed?
         ↓ Yes
Deploy to Vercel Workflow
         ↓
Production Deployment
```

## 最佳实践

1. **永远不要绕过 CI** - 质量优先于速度
2. **使用 PR 进行预览** - Pull Request 会自动创建预览环境
3. **监控部署状态** - 确保部署成功后进行验证
4. **保持文档更新** - CI/CD 配置变更需要更新此文档

## 故障排除

### 问题：Vercel 部署了有问题的代码
- 原因：Vercel 自动部署没有等待 CI
- 解决：确保 `deploymentEnabled: false` 已配置

### 问题：CI 通过但没有部署
- 原因：workflow_run 事件没有触发
- 解决：检查 GitHub Actions 日志，确认事件链

### 问题：需要紧急修复
- 使用 hotfix 分支
- 创建 PR 并通过所有检查
- 合并后自动部署