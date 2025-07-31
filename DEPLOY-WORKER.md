# 部署 Cloudflare Worker 说明

## 🚨 重要：请部署正确的文件！

当前部署的 Worker 似乎没有查询功能。请按以下步骤更新：

### 1. 登录 Cloudflare Dashboard
访问 https://dash.cloudflare.com/

### 2. 找到您的 Worker
名称应该是 `jiaoben-api`

### 3. 更新代码
请使用以下文件的内容替换现有代码：
```
cloudflare-worker-with-query.js
```

这个文件包含了：
- ✅ `/api/process` - 处理抖音链接
- ✅ `/api/task/query` - 查询转文字结果（目前缺失的功能）
- ✅ 音频优先选择逻辑

### 4. 部署步骤
1. 点击 "Quick Edit" 或进入编辑器
2. 删除现有代码
3. 复制 `cloudflare-worker-with-query.js` 的全部内容
4. 粘贴到编辑器
5. 点击 "Save and Deploy"

### 5. 验证部署
部署后，访问以下URL测试：
- https://jiaoben-api.keating8500.workers.dev/api/test
- 应该返回 `{"success":true,"message":"Worker正常运行",...}`

### 6. 环境变量确认
确保以下环境变量已设置：
- `TIKHUB_API_TOKEN`
- `YUNMAO_API_KEY`

## 📝 注意事项
- 部署后需要等待 1-2 分钟生效
- 如果还是 404，可能需要清除浏览器缓存
- 确保使用的是 `cloudflare-worker-with-query.js`，不是其他版本