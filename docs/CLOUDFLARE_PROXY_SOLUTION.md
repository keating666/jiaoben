# 🚀 临时解决方案：Cloudflare Workers 代理

既然 Vercel 部署到香港有困难，我们可以使用 Cloudflare Workers 作为代理。

## 方案优势
1. **全球边缘网络** - Cloudflare 有香港节点
2. **免费额度充足** - 每天 100,000 次请求
3. **部署简单** - 几分钟完成
4. **低延迟** - 自动路由到最近节点

## 快速部署步骤

### 1. 创建 Cloudflare Worker

创建文件 `tikhub-proxy.js`：

```javascript
export default {
  async fetch(request) {
    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 获取请求体
      const { douyinUrl } = await request.json();
      
      // 调用 TikHub API
      const tikHubResponse = await fetch(
        `https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(douyinUrl)}`,
        {
          headers: {
            'Authorization': `Bearer YOUR_TIKHUB_API_KEY`,
            'Accept': 'application/json'
          }
        }
      );

      const data = await tikHubResponse.json();
      
      // 返回结果
      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        }
      });
    }
  }
};
```

### 2. 部署到 Cloudflare

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择 Workers & Pages
3. 创建新 Worker
4. 粘贴代码并部署
5. 获得 Worker URL (如: `https://tikhub-proxy.YOUR-SUBDOMAIN.workers.dev`)

### 3. 修改前端调用

将 API 调用改为：

```javascript
// 原来：直接调用 TikHub
// 现在：通过 Cloudflare Worker
const response = await fetch('https://tikhub-proxy.YOUR-SUBDOMAIN.workers.dev', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ douyinUrl })
});
```

## 完整的代理服务

如果需要代理所有 API，创建 `api-proxy.js`：

```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // 路由映射
    const routes = {
      '/tikhub': 'https://api.tikhub.io',
      '/yunmao': 'https://api.guangfan.tech'
    };
    
    // 提取路由前缀
    const routePrefix = Object.keys(routes).find(prefix => 
      url.pathname.startsWith(prefix)
    );
    
    if (!routePrefix) {
      return new Response('Not Found', { status: 404 });
    }
    
    // 构建目标 URL
    const targetUrl = routes[routePrefix] + 
      url.pathname.replace(routePrefix, '');
    
    // 转发请求
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    
    // 添加 CORS 头
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  }
};
```

## 优点
1. ✅ 绕过地理限制
2. ✅ 提高访问速度
3. ✅ 简化部署流程
4. ✅ 免费且可靠

## 注意事项
- 将 API 密钥存储在 Cloudflare 环境变量中
- 监控使用量避免超出免费额度
- 可以添加缓存提高性能

---

这是一个快速有效的解决方案，可以立即解决香港部署的问题！