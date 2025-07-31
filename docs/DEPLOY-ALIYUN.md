# 🚀 部署阿里云版本 Worker - 详细步骤

## 方案优势

- **阿里云 ASR**：200 QPS，专业的语音识别服务，支持异步处理
- **通义千问**：1200 QPM，强大的文本生成能力
- **稳定可靠**：企业级服务，有明确的SLA保障

## 一、获取阿里云凭证

### 1. 开通阿里云智能语音服务
1. 访问 [阿里云智能语音控制台](https://nls.console.aliyun.com/)
2. 开通服务并创建项目
3. 获取以下信息：
   - Access Key ID
   - Access Key Secret
   - App Key

### 2. 开通通义千问服务
1. 访问 [阿里云DashScope控制台](https://dashscope.aliyun.com/)
2. 开通通义千问服务
3. 创建API Key
4. 记录 API Key

## 二、配置 Cloudflare Worker 环境变量

### 1. 登录 Cloudflare
- 访问 https://dash.cloudflare.com/
- 进入您的账户

### 2. 创建新 Worker 或更新现有 Worker
- 左侧菜单点击 **Workers & Pages**
- 创建新 Worker 命名为 `jiaoben-aliyun` 或继续使用 `jiaoben-api`

### 3. 配置环境变量
- 点击 **Settings** 标签
- 找到 **Variables** 部分
- 点击 **Edit variables**
- 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| TIKHUB_API_TOKEN | 您的TikHub Token | 保持不变 |
| ALIYUN_ACCESS_KEY_ID | 您的AccessKeyId | 阿里云访问密钥ID |
| ALIYUN_ACCESS_KEY_SECRET | 您的AccessKeySecret | 阿里云访问密钥 |
| ALIYUN_APP_KEY | 您的AppKey | 智能语音应用Key |
| QWEN_API_KEY | 您的通义千问APIKey | DashScope API密钥 |

- 点击 **Save**

## 三、部署 Worker 代码

### 1. 进入代码编辑器
- 在 Worker 页面，点击 **Quick edit** 按钮

### 2. 替换代码
- **删除所有现有代码**
- 复制 `cloudflare-worker-aliyun.js` 的全部内容
- 粘贴到编辑器中

### 3. 部署
- 点击 **Save and Deploy**
- 等待部署完成（通常几秒钟）

## 四、测试部署

### 1. 测试 API 状态
访问：https://[your-worker-name].workers.dev/api/test

应该看到类似这样的响应：
```json
{
  "success": true,
  "message": "Worker正常运行",
  "timestamp": "2025-07-29T...",
  "aliyun": {
    "asrConfigured": true,
    "qwenConfigured": true
  }
}
```

### 2. 使用测试页面
创建测试页面进行完整流程测试

## 五、阿里云服务说明

### ASR（语音识别）限制
- 默认配额：200 QPS
- 单个音频文件最大：512MB
- 支持格式：MP3, WAV, M4A等
- 识别时长：最长5小时

### 通义千问限制
- qwen-turbo：1200 QPM，5,000,000 TPM
- 单次请求最大：8K tokens
- 响应时间：通常1-3秒

## 六、费用说明

### ASR 定价
- 录音文件识别：¥1.8/小时
- 首次开通赠送一定免费额度

### 通义千问定价
- qwen-turbo：¥2/百万tokens
- 新用户有免费额度

## 七、故障排除

### 问题1：ASR 提交失败
- 检查 Access Key 是否正确
- 确认服务已开通
- 查看音频URL是否可访问

### 问题2：通义千问调用失败
- 检查 API Key 是否正确
- 确认额度是否充足
- 查看请求格式是否正确

### 问题3：处理超时
- ASR 处理较长音频可能需要时间
- 可以增加等待时间或使用回调方式

## 八、优化建议

1. **使用队列系统**
   - 对于大量请求，建议使用消息队列
   - 避免直接等待ASR结果

2. **缓存机制**
   - 相同音频可以缓存识别结果
   - 减少重复调用

3. **错误重试**
   - 实现指数退避重试机制
   - 提高系统稳定性

## 九、联系支持

如遇到问题：
1. 查看 Cloudflare Worker 日志
2. 检查阿里云控制台错误信息
3. 参考官方文档或联系技术支持