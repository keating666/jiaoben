# 🚨 快速修复环境变量

## 方法1：通过 Cloudflare Dashboard（推荐）

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 点击 **jiaoben-api**
4. 点击 **Settings** → **Variables**
5. 点击 **Add variable** 添加以下变量：

   | 变量名 | 说明 |
   |--------|------|
   | TIKHUB_API_TOKEN | TikHub API Token |
   | ALIYUN_ACCESS_KEY_ID | 阿里云 AccessKey ID |
   | ALIYUN_ACCESS_KEY_SECRET | 阿里云 AccessKey Secret（加密存储）|
   | ALIYUN_APP_KEY | 阿里云 ASR App Key |
   | QWEN_API_KEY | 通义千问 API Key |

6. 点击 **Save and deploy**

## 方法2：通过命令行

```bash
# 运行修复脚本
chmod +x fix-env-vars.sh
./fix-env-vars.sh
```

脚本会提示您输入每个环境变量的值。

## 方法3：从旧Worker复制设置

如果之前的 Worker 有这些环境变量，可以：
1. 在 Dashboard 中查看旧 Worker 的设置
2. 复制环境变量值
3. 粘贴到新 Worker 中

## 验证

设置完成后，访问：
https://jiaoben-api.keating8500.workers.dev/api/test

应该看到所有功能都是 `true`：
```json
{
  "features": {
    "linkCleaning": true,
    "realASR": true,
    "aiGeneration": true,
    "tikhub": true
  }
}
```