# Transcribe V3 集成计划

## 当前状态
- ✅ 环境变量配置完成
- ✅ 基础流程验证完成
- ✅ 通义千问 API 工作正常
- ⏳ TikHub 和云猫 API 待集成

## Phase 1: TikHub 集成（优先）

### 1.1 创建 TikHub 简化客户端
```javascript
// tikhub-simple.js
async function resolveTikHubVideo(shareUrl) {
  // 调用 TikHub Web API
  // 返回真实视频 URL
}
```

### 1.2 测试步骤
1. 单独测试 TikHub API 连接
2. 获取真实视频地址
3. 集成到 transcribe-v3-simple.js

## Phase 2: 云猫转码集成

### 2.1 创建云猫简化客户端
```javascript
// yunmao-simple.js
async function transcribeWithYunmao(videoUrl) {
  // 调用云猫 API
  // 返回转录文本
}
```

### 2.2 测试步骤
1. 测试云猫 API 连接
2. 提交视频转录任务
3. 获取转录结果

## Phase 3: 完整集成

### 3.1 更新 transcribe-v3-simple.js
- 替换模拟数据为真实 API 调用
- 添加降级策略
- 完善错误处理

### 3.2 性能优化
- 添加缓存机制
- 优化 API 调用顺序
- 实现并发控制

## Phase 4: 部署

### 4.1 准备部署
- 清理测试代码
- 优化包大小
- 配置环境变量

### 4.2 Vercel 部署
```bash
git add api/video/transcribe-v3-simple.js
git commit -m "feat: 添加 transcribe-v3 简化版端点"
git push
```

## 测试检查清单

- [ ] TikHub API 可以正常连接
- [ ] 云猫 API 可以提交任务
- [ ] 错误处理正常工作
- [ ] 降级策略可以触发
- [ ] 性能符合预期（< 30秒）

## 风险点
1. TikHub API 可能有请求限制
2. 云猫转码可能需要较长时间
3. Vercel Functions 有 60 秒超时限制

## 备选方案
1. 如果 TikHub 失败 → 使用原始 URL
2. 如果云猫失败 → 使用 MiniMax
3. 如果超时 → 返回部分结果