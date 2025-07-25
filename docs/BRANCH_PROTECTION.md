# Branch Protection 配置指南

## 重要：保护 main 分支

为了确保代码质量，请在 GitHub 仓库设置中配置以下 Branch Protection Rules：

### 设置路径
Settings → Branches → Add rule → Branch name pattern: `main`

### 必须启用的保护规则

1. **Require a pull request before merging**
   - ✅ Require approvals: 1
   - ✅ Dismiss stale pull request approvals when new commits are pushed

2. **Require status checks to pass before merging**
   - ✅ Require branches to be up to date before merging
   - 必需的状态检查：
     - `Code Quality Check`
     - `Build Check`

3. **Require conversation resolution before merging**
   - ✅ 所有评论必须解决

4. **Include administrators**
   - ⚠️ 建议启用，防止意外直接推送

## CI/CD 流程

现在的流程是：
1. 创建 feature 分支
2. 提交代码，创建 PR
3. CI 自动运行质量检查
4. Review 通过后合并
5. 合并到 main 后自动部署到 Vercel

## 紧急修复流程

如果需要紧急修复：
1. 创建 `hotfix/` 分支
2. 修复问题
3. 创建 PR（可以设置为紧急，减少 review 要求）
4. 合并后自动部署

## 为什么这样配置？

- **质量保证**：所有代码必须通过 CI 检查
- **代码审查**：至少一人 review，避免低级错误
- **自动化部署**：合并即部署，减少手动操作
- **可追溯性**：所有变更都有 PR 记录