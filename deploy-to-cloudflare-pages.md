# 🚀 部署前端到 Cloudflare Pages

## 为什么选择 Cloudflare？

1. **统一平台**：Workers（API）+ Pages（前端）
2. **无 CORS 问题**：同一个域名下
3. **全球 CDN**：自动就近访问
4. **完全免费**：个人项目足够用
5. **自动 HTTPS**：安全访问

## 部署步骤

### 方法一：通过 GitHub（推荐）

1. **创建 GitHub 仓库**
   ```bash
   git init
   git add production-app.html
   git commit -m "Add production app"
   git remote add origin https://github.com/YOUR_USERNAME/jiaoben-frontend.git
   git push -u origin main
   ```

2. **连接 Cloudflare Pages**
   - 登录 Cloudflare Dashboard
   - Workers & Pages → Create application → Pages
   - Connect to Git → 选择您的仓库
   - 部署设置保持默认
   - Deploy

3. **获得域名**
   - 自动分配：`jiaoben-frontend.pages.dev`
   - 支持自定义域名

### 方法二：直接上传

1. **准备文件**
   - 创建文件夹 `jiaoben-site`
   - 将 `production-app.html` 重命名为 `index.html`
   - 放入文件夹

2. **上传部署**
   - Cloudflare Dashboard → Pages
   - Create a project → Upload assets
   - 拖拽文件夹上传
   - Deploy

### 方法三：使用 Wrangler CLI

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录
wrangler login

# 创建项目
mkdir jiaoben-frontend
cd jiaoben-frontend
cp ../production-app.html index.html

# 部署
wrangler pages publish . --project-name=jiaoben-frontend
```

## 部署后配置

### 1. 更新 Worker URL
确保 HTML 中的 Worker URL 正确：
```javascript
const WORKER_URL = 'https://jiaoben-api.keating8500.workers.dev';
```

### 2. 访问您的应用
- Pages URL: `https://jiaoben-frontend.pages.dev`
- 完全在线，无需本地服务器
- 任何人都可以访问使用

### 3. 可选：绑定自定义域名
- 在 Pages 设置中添加自定义域名
- Cloudflare 自动配置 SSL

## 最终架构

```
用户 → jiaoben-frontend.pages.dev (前端)
        ↓
        jiaoben-api.workers.dev (API)
        ↓
        TikHub + 阿里云 ASR + 通义千问
```

## 优势对比

| 特性 | Vercel | Cloudflare |
|-----|--------|------------|
| 地域限制 | 需要 Pro | 自动全球 |
| API 路由 | Serverless Functions | Workers |
| 前端托管 | 支持 | Pages |
| CORS | 需要配置 | 同域无需配置 |
| 费用 | 有限免费 | 慷慨免费额度 |

## 总结

**是的，您完全可以放弃 Vercel！**

Cloudflare 提供了完整的解决方案：
- Workers 处理 API
- Pages 托管前端
- KV 存储数据（如需要）
- 无地域限制
- 完全免费

现在就部署您的前端到 Cloudflare Pages，让用户可以直接在线使用！