# 🚀 部署修复版ASR到Cloudflare

## 步骤1：安装Wrangler（如果还没安装）
```bash
npm install -g wrangler
```

## 步骤2：登录Cloudflare
```bash
wrangler login
```

## 步骤3：部署Worker
```bash
wrangler publish cloudflare-worker-fixed-asr.js --name jiaoben-api
```

或者如果您想保留现有Worker，创建新的测试版本：
```bash
wrangler publish cloudflare-worker-fixed-asr.js --name jiaoben-api-test
```

## 步骤4：配置环境变量
在Cloudflare Dashboard中：
1. 进入 Workers & Pages
2. 选择 jiaoben-api
3. 点击 Settings → Variables
4. 确保以下变量已配置：
   - TIKHUB_API_TOKEN
   - ALIYUN_ACCESS_KEY_ID
   - ALIYUN_ACCESS_KEY_SECRET
   - ALIYUN_APP_KEY
   - QWEN_API_KEY

## 步骤5：测试
访问：https://jiaoben-api.keating8500.workers.dev/api/test

应该看到：
```json
{
  "success": true,
  "message": "Worker正常运行 - 修复版（使用Node.js crypto）",
  "features": {
    "linkCleaning": true,
    "realASR": true,
    "aiGeneration": true,
    "tikhub": true,
    "cryptoSupport": "nodejs"
  }
}
```

## 注意事项
- 关键配置：`compatibility_flags = ["nodejs_compat"]`
- 这允许使用 `import crypto from 'node:crypto'`
- 签名算法现在使用原生的 HMAC-SHA1

## 预期结果
- ASR应该能正常工作
- 返回真实的语音识别结果
- 不再使用模拟转写