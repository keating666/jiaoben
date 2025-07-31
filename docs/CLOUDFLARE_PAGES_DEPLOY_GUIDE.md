# 📘 Cloudflare Pages 部署详细指南

## 方法 A：直接拖拽上传（最简单，5分钟完成）

### 步骤 1：准备文件
```bash
# 创建部署文件夹
mkdir story-0.2-demo
cd story-0.2-demo

# 复制 HTML 文件并重命名为 index.html（重要！）
cp ../production-app.html index.html
```

**注意**：文件必须命名为 `index.html`，这是 Cloudflare Pages 的默认首页。

### 步骤 2：登录 Cloudflare
1. 打开浏览器访问：https://dash.cloudflare.com
2. 使用您的账号登录（如果没有账号，免费注册一个）

### 步骤 3：创建 Pages 项目
1. 在左侧菜单找到 **Workers & Pages**
2. 点击右上角的 **Create application** 按钮
3. 选择 **Pages** 标签页
4. 点击 **Upload assets** 按钮

### 步骤 4：上传文件
1. 你会看到一个拖拽区域
2. 打开文件管理器，找到刚才创建的 `story-0.2-demo` 文件夹
3. **直接拖拽整个文件夹**到浏览器的拖拽区域
4. 等待文件上传（几秒钟）

### 步骤 5：配置项目
1. **项目名称**：输入 `jiaoben-demo`（或其他您喜欢的名字）
   - 这将决定您的访问地址：`https://jiaoben-demo.pages.dev`
2. 点击 **Deploy site** 按钮

### 步骤 6：等待部署
1. Cloudflare 会显示部署进度
2. 通常 1-2 分钟内完成
3. 部署成功后，会显示您的网站地址

### 步骤 7：访问测试
1. 点击显示的链接（如：https://jiaoben-demo.pages.dev）
2. 确认页面正常显示
3. 测试功能是否正常

---

## 方法 B：通过 GitHub 部署（适合开发者，支持自动更新）

### 前置要求
- 有 GitHub 账号
- 安装了 Git

### 步骤 1：创建本地仓库
```bash
# 创建项目文件夹
mkdir jiaoben-frontend
cd jiaoben-frontend

# 复制文件
cp ../production-app.html index.html

# 初始化 Git
git init
git add index.html
git commit -m "Initial commit - Story 0.2 Demo"
```

### 步骤 2：创建 GitHub 仓库
1. 访问 https://github.com/new
2. 仓库名称：`jiaoben-frontend`
3. 设置为 Public（公开）
4. 不要勾选任何初始化选项
5. 点击 **Create repository**

### 步骤 3：推送代码
```bash
# 添加远程仓库（替换 YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/jiaoben-frontend.git

# 推送代码
git branch -M main
git push -u origin main
```

### 步骤 4：连接 Cloudflare Pages
1. 回到 Cloudflare Dashboard
2. Workers & Pages → Create application → Pages
3. 选择 **Connect to Git**
4. 选择 **GitHub**
5. 授权 Cloudflare 访问您的 GitHub

### 步骤 5：选择仓库
1. 在列表中找到 `jiaoben-frontend`
2. 点击选择
3. 点击 **Begin setup**

### 步骤 6：配置构建设置
1. **Production branch**：main
2. **Build command**：留空（我们只有静态文件）
3. **Build output directory**：留空
4. 点击 **Save and Deploy**

### 步骤 7：等待部署
1. Cloudflare 会自动从 GitHub 拉取代码
2. 部署完成后显示访问地址

### 优势对比

| 特性 | 直接上传 | GitHub 部署 |
|-----|---------|------------|
| 速度 | ⭐⭐⭐⭐⭐ 最快 | ⭐⭐⭐ 需要设置 |
| 更新 | 需要重新上传 | Git push 自动更新 |
| 版本控制 | ❌ 无 | ✅ 有 |
| 协作 | ❌ 困难 | ✅ 方便 |
| 适合人群 | 新手/快速演示 | 开发者/长期项目 |

---

## 🔧 常见问题解决

### 1. 上传失败
- 检查文件夹内是否有 index.html
- 确保没有超大文件（视频等）
- 尝试刷新页面重试

### 2. 部署后 404 错误
- 确认文件名是 `index.html` 而不是其他
- 等待 1-2 分钟让 CDN 更新

### 3. 页面显示但功能不工作
- 打开浏览器控制台查看错误
- 确认 Worker API 地址正确
- 检查 CORS 设置

### 4. 想要更新内容
- 方法 A：删除项目重新上传
- 方法 B：Git push 会自动触发更新

---

## 🎯 部署成功后

### 获得的内容
1. **主域名**：https://your-project.pages.dev
2. **预览链接**：每次部署都有唯一预览链接
3. **自定义域名**：可以绑定自己的域名

### 下一步
1. 发送链接给甲方测试
2. 收集反馈
3. 持续优化

### 监控和分析
- Cloudflare 提供免费的访问分析
- 可以看到访问量、地理分布等数据

---

## 💡 专业提示

1. **性能优化**
   - Pages 自动启用 HTTP/2 和 Brotli 压缩
   - 全球 CDN 自动加速

2. **安全性**
   - 自动 HTTPS
   - DDoS 防护

3. **扩展功能**
   - 可以添加 _redirects 文件配置重定向
   - 支持 _headers 文件自定义响应头

需要帮助？随时问我！