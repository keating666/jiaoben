# 🚀 紧急部署指南

## 方法1：通过 Vercel Dashboard 手动部署

1. **访问 Vercel Dashboard**
   - https://vercel.com/dashboard

2. **找到 jiaoben 项目**
   - 点击进入项目

3. **手动部署**
   - 点击右上角 "..." 菜单
   - 选择 "Redeploy"
   - 选择 "Use existing Build Cache"
   - 点击 "Redeploy"

## 方法2：使用 Vercel CLI（如果你本地有）

```bash
# 安装 Vercel CLI（如果没有）
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

## 方法3：重新连接 GitHub

如果上述方法都不行：

1. 在 Vercel Dashboard 中
2. 进入 jiaoben 项目设置
3. Git → Disconnect from Git
4. 然后重新连接 GitHub 仓库

## 🔍 检查点

部署成功后，Vercel 会给你一个新的 URL，格式类似：
- jiaoben.vercel.app
- jiaoben-git-main-xxx.vercel.app
- jiaoben-xxx.vercel.app

记下这个 URL，然后访问：
`[你的URL]/video-transcribe-dashboard.html`