# Vercel 项目检查清单

## 在 Vercel Dashboard 中检查以下设置

### 1. Git 集成（Settings → Git）
- [ ] Connected to: keating666/jiaoben
- [ ] Production Branch: main
- [ ] Auto-deploy: Enabled

### 2. 环境变量（Settings → Environment Variables）
确保这些已设置：
- [ ] MINIMAX_API_KEY
- [ ] TONGYI_API_KEY
- [ ] 其他必要的 API 密钥

### 3. 项目根目录（Settings → General）
- [ ] Root Directory: ./ （留空或设为 ./）
- [ ] Build Command: （留空，使用默认）
- [ ] Output Directory: （留空，使用默认）

### 4. Functions 配置（Settings → Functions）
- [ ] Node.js Version: 18.x

## 🚨 如果 Git 集成断开了

1. 点击 "Connect Git Repository"
2. 选择 GitHub
3. 选择 keating666/jiaoben
4. 确认连接

## 📝 部署后验证

成功部署后，你会看到：
- Status: Ready ✅
- 一个可访问的 URL

然后访问：
`[部署URL]/video-transcribe-dashboard.html`