# 🚀 Cloudflare 统一部署脚本

简化的 CI/CD 工作流，基于 Cloudflare 生态系统优化。

## 📋 快速开始

### 1️⃣ 首次配置（仅需一次）

```bash
# 添加执行权限
chmod +x scripts/*.sh

# 配置环境变量
./scripts/setup-env.sh
```

### 2️⃣ 日常开发

```bash
# 启动本地开发环境
./scripts/dev.sh

# 访问：
# - Workers API: http://localhost:8787
# - 前端页面: http://localhost:3000
```

### 3️⃣ 部署上线

```bash
# 一键部署（Workers + Pages）
./scripts/deploy-unified.sh
```

### 4️⃣ 测试验证

```bash
# 快速测试部署状态
./scripts/test.sh
```

## 🛠️ 脚本说明

| 脚本 | 功能 | 用途 |
|------|------|------|
| `setup-env.sh` | 环境变量配置向导 | 首次配置或更新密钥 |
| `dev.sh` | 本地开发环境 | 日常开发调试 |
| `deploy-unified.sh` | 统一部署 | 生产环境部署 |
| `test.sh` | 部署测试 | 验证部署状态 |

## ✨ 优化效果

**优化前：**
- 🔴 5个手动步骤
- 🔴 多处配置环境变量  
- 🔴 部署状态不透明
- 🔴 缓存问题难排查

**优化后：**
- ✅ 1个命令完成所有部署
- ✅ 统一环境变量管理
- ✅ 自动验证部署结果
- ✅ 智能缓存清理

## 🚨 故障排查

### 部署失败
```bash
# 检查 Workers 状态
wrangler dev

# 检查环境变量
wrangler secret list

# 手动测试 API
curl https://jiaoben-api.keating8500.workers.dev/api/test
```

### 页面未更新
```bash
# 清除浏览器缓存 Ctrl+F5
# 或等待 2-3 分钟 CDN 更新
```

## 💡 开发建议

1. **本地开发**：始终使用 `./scripts/dev.sh`
2. **测试验证**：部署后运行 `./scripts/test.sh`
3. **环境管理**：定期检查 `wrangler secret list`
4. **缓存问题**：遇到更新不及时，等待或手动清除缓存

---

**网络优化**: 基于 Cloudflare 全球网络，在中国大陆访问体验优秀 🇨🇳