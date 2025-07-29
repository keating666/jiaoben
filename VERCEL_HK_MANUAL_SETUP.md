# 🚨 重要：Vercel 香港部署手动设置

如果部署仍然在美国，请在 Vercel Dashboard 中进行以下设置：

## 步骤 1：进入项目设置
1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 `jiaoben` 项目
3. 点击顶部的 `Settings` 标签

## 步骤 2：设置函数区域
1. 在左侧菜单找到 `Functions`
2. 找到 `Function Region` 设置
3. 选择 `Hong Kong (hkg1)`
4. 点击 `Save`

## 步骤 3：设置环境变量（如果需要）
1. 在左侧菜单找到 `Environment Variables`
2. 添加新变量：
   - Name: `VERCEL_REGION`
   - Value: `hkg1`
   - Environment: 选择 `Production`
3. 点击 `Save`

## 步骤 4：重新部署
1. 回到项目主页
2. 点击最新的部署
3. 点击右上角的三个点 `...`
4. 选择 `Redeploy`
5. 在弹出的对话框中点击 `Redeploy`

## 验证部署区域
部署完成后，访问：
```
https://jiaoben-7jx4.vercel.app/api/test-region
```

应该看到：
```json
{
  "deployment": {
    "region": "hkg1",
    ...
  }
}
```

## 测试页面
- 主测试页面：https://jiaoben-7jx4.vercel.app/test-hk-deployment.html
- 抖音测试页面：https://jiaoben-7jx4.vercel.app/test-douyin-hk.html

## 注意事项
1. **Pro 账户必需**：只有 Pro 账户才能选择亚洲区域
2. **首次设置**：第一次设置可能需要等待几分钟生效
3. **缓存清理**：如果还是部署到美国，可能需要删除项目重新导入

## 如果还是不行
考虑使用 Vercel CLI 强制部署：
```bash
vercel --prod --regions hkg1
```

或者在项目根目录创建 `.vercel/project.json`：
```json
{
  "projectId": "你的项目ID",
  "orgId": "你的组织ID",
  "settings": {
    "buildCommand": "npm run build || echo 'No build script'",
    "devCommand": null,
    "outputDirectory": null,
    "directoryListing": false,
    "rootDirectory": null,
    "framework": null,
    "functionRegion": "hkg1"
  }
}
```

---

*请按照以上步骤操作，确保部署到香港区域！*