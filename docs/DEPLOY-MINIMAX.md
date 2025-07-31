# 🚀 部署 MiniMax 版本 Worker - 详细步骤

## 一、添加环境变量（先做这个）

### 1. 登录 Cloudflare
- 访问 https://dash.cloudflare.com/
- 进入您的账户

### 2. 找到 Worker
- 左侧菜单点击 **Workers & Pages**
- 找到 `jiaoben-api` Worker
- 点击进入

### 3. 配置环境变量
- 点击 **Settings** 标签
- 找到 **Variables** 部分
- 点击 **Edit variables**
- 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| MINIMAX_API_KEY | 您的API密钥 | 从MiniMax控制台获取 |
| MINIMAX_GROUP_ID | 您的组ID | 从MiniMax控制台获取 |
| MINIMAX_API_BASE | https://api.minimax.chat/v1 | API基础地址 |

- 点击 **Save**

## 二、更新 Worker 代码

### 1. 进入代码编辑器
- 在 Worker 页面，点击 **Quick edit** 按钮

### 2. 替换代码
- **删除所有现有代码**
- 复制 `cloudflare-worker-minimax.js` 的全部内容
- 粘贴到编辑器中

### 3. 部署
- 点击 **Save and Deploy**
- 等待部署完成（通常几秒钟）

## 三、验证部署

### 1. 测试 API 状态
访问：https://jiaoben-api.keating8500.workers.dev/api/test

应该看到类似这样的响应：
```json
{
  "success": true,
  "message": "Worker正常运行",
  "timestamp": "2025-07-29T...",
  "minimax": {
    "configured": true,
    "groupId": "已配置"
  }
}
```

### 2. 测试页面
- 打开 `douyin-minimax-script.html`
- 右上角应该显示 "✅ MiniMax API已配置"
- 输入抖音链接测试

## 四、如果遇到问题

### 问题1：MiniMax API 未配置
- 检查环境变量是否正确添加
- 确保点击了 Save

### 问题2：语音识别失败
- MiniMax 的语音识别 API 可能需要特定权限
- 暂时会使用模拟数据

### 问题3：Worker 错误
- 查看实时日志：Worker 页面 → Logs
- 检查错误信息

## 五、获取 MiniMax API 凭证

如果您还没有 MiniMax API 凭证：

1. 访问 [MiniMax 开放平台](https://api.minimax.chat/)
2. 注册/登录账号
3. 创建应用
4. 获取 API Key 和 Group ID

## 六、注意事项

- 部署后需要等待 1-2 分钟生效
- 确保之前的 KV 存储绑定保持不变
- 原有的功能（如 TikHub 集成）仍然可用