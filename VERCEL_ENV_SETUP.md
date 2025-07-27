# Vercel 环境变量配置说明

## 需要在 Vercel Dashboard 中配置的环境变量

请登录到 Vercel Dashboard，在项目设置中添加以下环境变量：

### 必需的环境变量

1. **YUNMAO_API_KEY**
   - 值: `wtFx2bKVoRAtrXFcHNfBp725`
   - 用途: 云猫转码 API 认证密钥

2. **TIKHUB_API_TOKEN**
   - 值: `458PVEdr/V4XhgcW+jKIwVEtwVU0hqzJsqpqnQjCnm1B6G0tVuRW/FrvMg==`
   - 用途: TikHub API 认证令牌

3. **TONGYI_API_KEY**
   - 值: `sk-13a2a6730cbd4de3807b7b70e3258bc3`
   - 用途: 通义千问 API 密钥

4. **MINIMAX_API_KEY**
   - 值: 见 .env 文件
   - 用途: MiniMax API 密钥

5. **MINIMAX_GROUP_ID**
   - 值: `1910316520781648303`
   - 用途: MiniMax 组ID

## 配置步骤

1. 登录 Vercel Dashboard
2. 选择 `jiaoben` 项目
3. 进入 Settings → Environment Variables
4. 逐个添加上述环境变量
5. 确保选择所有环境（Production, Preview, Development）
6. 保存更改

## 验证配置

配置完成后，可以通过以下方式验证：

1. 访问: https://jiaoben-7jx4.vercel.app/test-yunmao-two-step.html
2. 提交测试任务
3. 如果不再出现"用户不存在"错误，说明配置成功

## 注意事项

- 环境变量在 Vercel 中是加密存储的
- 修改环境变量后，可能需要重新部署才能生效
- 可以在 Functions 日志中查看详细的错误信息