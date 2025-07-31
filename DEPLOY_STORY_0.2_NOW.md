# 🚨 立即部署 Story 0.2 演示页面

## 🎯 目标：让甲方立即看到可用的在线演示

### 步骤 1：更新 Worker（2分钟）
1. 登录 https://dash.cloudflare.com
2. Workers & Pages → 找到 `jiaoben-api`
3. 点击 "Quick edit"
4. 删除所有内容，粘贴 `cloudflare-worker-simple-qwen.js` 的代码
5. 点击 "Save and Deploy"
6. 测试：访问 https://jiaoben-api.keating8500.workers.dev/api/test

### 步骤 2：部署前端（5分钟）

#### 方法 A：直接上传（最快）
1. 创建文件夹 `story-0.2-demo`
2. 复制 `production-app.html` 到文件夹，重命名为 `index.html`
3. Cloudflare Dashboard → Pages → Create a project
4. Upload assets → 拖拽文件夹
5. 项目名：`jiaoben-demo`
6. Deploy

#### 方法 B：GitHub 部署
```bash
# 创建仓库
mkdir jiaoben-demo
cd jiaoben-demo
cp ../production-app.html index.html

# 初始化 Git
git init
git add index.html
git commit -m "Story 0.2 Demo"

# 推送到 GitHub
git remote add origin https://github.com/YOUR_USERNAME/jiaoben-demo.git
git push -u origin main
```

然后在 Cloudflare Pages 连接 GitHub 仓库。

### 步骤 3：获得演示地址

部署完成后，您将获得：
- **演示地址**：https://jiaoben-demo.pages.dev

### 步骤 4：发给甲方

```
Dear 甲方，

Story 0.2 的在线演示已经部署完成！

🔗 演示地址：https://jiaoben-demo.pages.dev

功能说明：
1. 粘贴抖音分享链接
2. 点击"生成分镜脚本"
3. 等待 AI 处理（约 10-20 秒）
4. 查看生成的专业分镜脚本

技术亮点：
- ✅ 完整的端到端流程
- ✅ 真实的 AI 处理（通义千问）
- ✅ 智能的内容分析
- ✅ 专业的脚本输出

期待您的反馈！

Best regards,
开发团队
```

## 🔥 紧急问题解决

### 如果 Worker 部署失败
- 检查是否有语法错误
- 确保环境变量配置了 TIKHUB_API_TOKEN 和 QWEN_API_KEY

### 如果前端无法访问
- 等待 1-2 分钟让 CDN 生效
- 清除浏览器缓存

### 如果处理失败
- 检查 Worker 日志
- 确认 API 密钥正确

## ⏱️ 预计时间
- Worker 部署：2 分钟
- 前端部署：5 分钟
- 总计：**7 分钟内完成**

现在就开始吧！