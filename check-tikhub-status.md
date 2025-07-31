# 🔍 TikHub API 故障排查指南

## 1. 检查 API 状态

### 方法 A：查看 TikHub 官方状态
- 访问 TikHub 官网或文档页面
- 查看是否有服务中断公告

### 方法 B：检查 Token 配额
在 Cloudflare Worker 日志中查看具体错误信息：
1. 登录 Cloudflare Dashboard
2. Workers & Pages → 您的 Worker
3. 点击 "Logs" 查看实时日志
4. 重新测试一个链接，查看详细错误

## 2. 可能的错误原因

### ❌ API 限流 (429)
- **症状**：返回 429 状态码
- **解决**：等待几分钟再试

### ❌ Token 无效 (401/403)
- **症状**：返回 401 或 403 状态码
- **解决**：检查 TIKHUB_API_TOKEN 是否正确

### ❌ 配额用尽
- **症状**：返回特定的配额错误信息
- **解决**：检查账户余额或升级套餐

### ❌ 服务暂时不可用 (500/503)
- **症状**：返回 5xx 错误
- **解决**：等待服务恢复

## 3. 临时解决方案

### 方案 A：使用备用 API
如果 TikHub 持续不可用，可以考虑：
1. 使用其他抖音解析 API
2. 暂时使用模拟数据演示

### 方案 B：添加错误重试机制
```javascript
async function callTikHubWithRetry(url, token, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // 如果是限流，等待后重试
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
        continue;
      }
      
      // 其他错误直接抛出
      throw new Error(`TikHub API error: ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

## 4. 调试步骤

1. **查看 Worker 日志**
   - 找到具体的错误代码和消息

2. **测试 Token**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://api.tikhub.io/api/v1/user/info
   ```

3. **检查环境变量**
   - 确保 TIKHUB_API_TOKEN 没有多余的空格或换行

4. **尝试官方示例**
   - 使用 TikHub 文档中的示例链接测试

## 5. 联系支持

如果以上都无法解决：
1. 联系 TikHub 技术支持
2. 提供错误日志和请求详情
3. 询问是否有 API 变更