# 🚀 5分钟部署 Cloudflare Workers 解决方案

## 第一步：部署 Worker（2分钟）

1. **登录 Cloudflare**
   - 访问 https://dash.cloudflare.com/
   - 如果没有账号，注册一个（免费）

2. **创建 Worker**
   - 点击左侧 "Workers & Pages"
   - 点击 "Create" → "Create Worker"
   - 给 Worker 起个名字，如 `jiaoben-api`

3. **粘贴代码**
   - 删除默认代码
   - 粘贴 `cloudflare-worker.js` 的内容
   - 点击 "Deploy"

## 第二步：配置环境变量（1分钟）

1. **进入 Worker 设置**
   - 在 Worker 页面点击 "Settings" → "Variables"

2. **添加 API 密钥**
   ```
   TIKHUB_API_TOKEN = 你的TikHub密钥
   YUNMAO_API_KEY = 你的云猫密钥
   ```

3. **保存并部署**

## 第三步：获取 Worker URL（30秒）

部署成功后，你会得到一个 URL：
```
https://jiaoben-api.YOUR-SUBDOMAIN.workers.dev
```

## 第四步：测试 API（1分钟）

### 测试区域
```bash
curl https://jiaoben-api.YOUR-SUBDOMAIN.workers.dev/api/test
```

应该返回：
```json
{
  "success": true,
  "region": "HKG",  // 或 SIN、NRT 等亚洲节点
  "timestamp": "2025-01-29T..."
}
```

### 测试完整流程
```bash
curl -X POST https://jiaoben-api.YOUR-SUBDOMAIN.workers.dev/api/douyin/process \
  -H "Content-Type: application/json" \
  -d '{"douyinUrl": "https://v.douyin.com/iRyBWfGS/"}'
```

## 第五步：更新前端调用（30秒）

修改你的前端代码，将 API 调用改为：

```javascript
// 原来
const response = await fetch('/api/douyin/complete-process', {...});

// 改为
const response = await fetch('https://jiaoben-api.YOUR-SUBDOMAIN.workers.dev/api/douyin/process', {...});
```

## ✅ 完成！

现在你的 API 会自动路由到最近的 Cloudflare 节点：
- 中国大陆用户 → 香港节点
- 东南亚用户 → 新加坡节点
- 日韩用户 → 东京/首尔节点

## 优势

1. **无需配置区域** - Cloudflare 自动选择最佳节点
2. **免费额度充足** - 每天 10万次请求
3. **全球低延迟** - 遍布全球的边缘节点
4. **稳定可靠** - 企业级基础设施

## 监控和调试

1. **查看日志**
   - Workers → 你的 Worker → "Logs"
   - 实时查看请求和错误

2. **查看分析**
   - Workers → 你的 Worker → "Analytics"
   - 查看请求量、错误率、响应时间

## 注意事项

- 免费版每天 100,000 次请求
- 单次执行时间限制 10ms（CPU时间）
- 如需更多资源，可升级到 Workers Paid（$5/月）

---

**就这么简单！** 5分钟内解决所有地理限制问题！🎉