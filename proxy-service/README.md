# 云猫API中转服务部署指南

由于Vercel访问云猫API存在网络延迟问题，我们创建了这个中转服务。

## 方案一：阿里云函数计算（推荐）

### 优势
- 国内网络，访问云猫API更快
- 按需付费，成本低
- 自动扩缩容

### 部署步骤

1. **登录阿里云函数计算控制台**
   ```
   https://fc.console.aliyun.com
   ```

2. **创建服务**
   - 服务名称：yunmao-proxy
   - 选择地域：华东2（上海）或华北2（北京）

3. **创建函数**
   - 函数名称：yunmao-handler
   - 运行环境：Node.js 16
   - 函数入口：aliyun-deploy.handler
   - 上传代码：上传 aliyun-deploy.js

4. **配置触发器**
   - 触发器类型：HTTP触发器
   - 认证方式：anonymous（匿名访问）
   - 请求方法：GET/POST/OPTIONS

5. **获取访问地址**
   ```
   https://xxxxx.cn-shanghai.fc.aliyuncs.com/2016-08-15/proxy/yunmao-proxy/yunmao-handler/
   ```

## 方案二：腾讯云函数

### 部署步骤

1. **安装Serverless Framework**
   ```bash
   npm install -g serverless
   ```

2. **配置serverless.yml**
   ```yaml
   service: yunmao-proxy
   
   provider:
     name: tencent
     runtime: Nodejs16.13
     region: ap-shanghai
     
   functions:
     proxy:
       handler: yunmao-proxy.handler
       events:
         - apigw:
             path: /proxy/{path+}
             method: ANY
   ```

3. **部署**
   ```bash
   serverless deploy
   ```

## 方案三：自建VPS（简单直接）

### 使用阿里云ECS或腾讯云CVM

1. **购买轻量应用服务器**
   - 配置：1核2G即可
   - 地域：选择上海或北京
   - 系统：Ubuntu 20.04

2. **部署步骤**
   ```bash
   # SSH登录服务器
   ssh root@your-server-ip
   
   # 安装Node.js
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # 克隆代码
   git clone https://github.com/keating666/jiaoben.git
   cd jiaoben/proxy-service
   
   # 安装依赖
   npm install
   
   # 安装PM2
   npm install -g pm2
   
   # 启动服务
   pm2 start yunmao-proxy.js --name yunmao-proxy
   pm2 save
   pm2 startup
   
   # 配置Nginx反向代理（可选）
   sudo apt-get install nginx
   ```

3. **Nginx配置**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 在Vercel中使用代理

修改你的API调用代码：

```javascript
// 原来的直接调用
const response = await fetch('https://api.guangfan.tech/v1/get-text', {...});

// 改为通过代理
const PROXY_URL = process.env.YUNMAO_PROXY_URL || 'https://your-proxy.com';
const response = await fetch(`${PROXY_URL}/proxy/submit`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videoUrl,
    language,
    apiKey: process.env.YUNMAO_API_KEY
  })
});
```

## 环境变量配置

在Vercel Dashboard添加：
```
YUNMAO_PROXY_URL=https://your-proxy-domain.com
```

## 测试代理服务

```bash
# 健康检查
curl https://your-proxy.com/health

# 提交任务
curl -X POST https://your-proxy.com/proxy/submit \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://sample-videos.com/video321/mp4/240/big_buck_bunny_240p_1mb.mp4",
    "language": "chinese",
    "apiKey": "your-api-key"
  }'

# 查询状态
curl https://your-proxy.com/proxy/status/TASK_ID?apiKey=your-api-key
```

## 成本估算

1. **阿里云函数计算**
   - 每月100万次免费调用
   - 超出部分：0.0133元/万次

2. **腾讯云函数**
   - 每月100万次免费调用
   - 超出部分：0.0133元/万次

3. **轻量应用服务器**
   - 阿里云：24元/月起（1核2G）
   - 腾讯云：28元/月起（1核2G）

## 推荐方案

- **开发测试**：使用阿里云函数计算，零成本
- **生产环境**：使用轻量应用服务器，更稳定可控