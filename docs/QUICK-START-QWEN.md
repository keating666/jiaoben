# 🚀 通义千问快速开始指南

## 5分钟快速部署

### 第一步：获取通义千问 API Key

1. 访问 [阿里云DashScope控制台](https://dashscope.console.aliyun.com/apiKey)
2. 点击"创建新的API-KEY"
3. 复制生成的 API Key

### 第二步：配置 Cloudflare Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 `jiaoben-api` Worker（或创建新的）
3. 点击 **Settings** → **Variables**
4. 添加环境变量：
   - `QWEN_API_KEY` = 您的通义千问API Key
   - `TIKHUB_API_TOKEN` = 保持原有的TikHub Token
5. 点击 **Save**

### 第三步：部署代码

1. 在 Worker 页面点击 **Quick edit**
2. 删除所有代码
3. 粘贴 `cloudflare-worker-qwen-simple.js` 的内容
4. 点击 **Save and Deploy**

### 第四步：测试

1. **测试API状态**：
   ```
   https://[your-worker].workers.dev/api/test
   ```

2. **测试通义千问**：
   使用 Postman 或 curl：
   ```bash
   curl -X POST https://[your-worker].workers.dev/api/test-qwen \
     -H "Content-Type: application/json" \
     -d '{"prompt": "你好，请介绍一下自己"}'
   ```

3. **测试完整流程**：
   打开任意测试页面，将 API 端点改为：
   ```
   /api/process-simple
   ```

## 通义千问优势

- **高配额**：1200 QPM，足够商用
- **低成本**：¥2/百万tokens
- **响应快**：通常1-3秒返回
- **中文优化**：对中文理解和生成效果极佳

## 注意事项

1. 这是简化版本，暂时使用模拟的语音识别数据
2. 完整版需要集成阿里云ASR服务
3. 首次使用有免费额度，用完后需要充值

## 费用预估

假设每天处理1000个视频：
- 每个视频生成800 tokens
- 每天消耗：800,000 tokens
- 每天费用：¥1.6
- 每月费用：约¥48

非常经济实惠！