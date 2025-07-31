# 配置 Cloudflare KV 存储（免费）

## 1. 创建 KV 命名空间

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择您的账户
3. 左侧菜单找到 **Workers & Pages**
4. 点击 **KV**
5. 点击 **Create namespace**
6. 命名为 `YUNMAO_RESULTS`
7. 点击 **Add**

## 2. 绑定 KV 到 Worker

1. 进入您的 Worker（jiaoben-api）
2. 点击 **Settings** 标签
3. 找到 **Variables** 部分
4. 在 **KV Namespace Bindings** 下点击 **Add binding**
5. 设置：
   - Variable name: `YUNMAO_RESULTS`
   - KV namespace: 选择刚创建的 `YUNMAO_RESULTS`
6. 点击 **Save**

## 3. 部署新的 Worker 代码

使用 `cloudflare-worker-callback.js` 的内容替换现有代码。

## 4. 功能说明

配置完成后，Worker 将支持：

- `/api/yunmao/callback` - 接收云猫的回调
- `/api/task/query` - 从 KV 查询结果
- `/api/tasks/list` - 列出所有已完成的任务（调试用）

## 5. 测试流程

1. 提交视频处理任务
2. 云猫处理完成后会回调到 Worker
3. Worker 将结果存储到 KV
4. 前端可以通过任务ID查询结果

## 注意事项

- KV 存储有最终一致性，写入后可能需要几秒才能读取
- 设置了 1 小时过期时间，避免存储过多历史数据
- 完全免费，不会产生任何费用