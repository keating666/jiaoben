# 🎯 阿里云语音识别（ASR）配置指南

## 一、开通服务

### 1. 访问阿里云智能语音控制台
- 访问 [智能语音交互控制台](https://nls.console.aliyun.com/)
- 首次访问需要开通服务（有免费额度）

### 2. 创建项目
1. 点击"创建项目"
2. 填写项目信息：
   - 项目名称：例如"抖音视频ASR"
   - 项目描述：视频语音识别

### 3. 获取凭证
创建项目后，您会获得：
- **Appkey**: 项目的唯一标识
- 在项目详情页可以看到

### 4. 获取 AccessKey
1. 访问 [RAM访问控制](https://ram.console.aliyun.com/users)
2. 创建用户或使用现有用户
3. 创建 AccessKey：
   - AccessKeyId
   - AccessKeySecret

## 二、配置 Cloudflare Worker

### 添加环境变量
在 Cloudflare Worker 设置中添加：

| 变量名 | 说明 |
|--------|------|
| ALIYUN_ACCESS_KEY_ID | RAM用户的AccessKeyId |
| ALIYUN_ACCESS_KEY_SECRET | RAM用户的AccessKeySecret |
| ALIYUN_APP_KEY | 智能语音项目的Appkey |
| QWEN_API_KEY | 通义千问API Key（已有） |
| TIKHUB_API_TOKEN | TikHub Token（已有） |

## 三、ASR 服务说明

### 支持的音频格式
- MP3（抖音常用）✅
- WAV
- M4A
- PCM

### 识别限制
- 单个文件最大：512MB
- 最长时长：5小时
- 采样率：8000Hz-48000Hz

### 费用
- 录音文件识别：¥1.8/小时
- 新用户免费额度：2小时

## 四、功能特性

### 已启用的功能
```javascript
{
  enable_punctuation_prediction: true,  // 智能标点
  enable_disfluency: true,             // 去除语气词
  enable_semantic_sentence_detection: true, // 语义断句
  enable_sample_rate_adaptive: true    // 自适应采样率
}
```

### 识别效果
- 支持中英文混合
- 自动识别方言
- 智能断句
- 过滤语气词（嗯、啊等）

## 五、测试流程

1. **先测试 Token 获取**
   ```
   GET /api/get-token
   ```
   应该返回一个 Token

2. **测试完整流程**
   使用抖音链接测试，系统会：
   - 提取音频URL
   - 提交ASR任务
   - 等待识别结果
   - 生成分镜脚本

## 六、常见问题

### Q: ASR识别失败怎么办？
A: 系统会自动降级到模拟数据，不影响整体流程

### Q: 识别需要多长时间？
A: 通常10-30秒，取决于音频长度

### Q: 可以识别背景音乐中的人声吗？
A: 可以！ASR会自动分离人声和背景音

## 七、优化建议

1. **批量处理**
   - 可以同时提交多个ASR任务
   - 使用任务ID管理

2. **结果缓存**
   - 相同音频URL可以缓存结果
   - 减少重复调用

3. **错误处理**
   - Token过期自动刷新
   - 网络错误自动重试