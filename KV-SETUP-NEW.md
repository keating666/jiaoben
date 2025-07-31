# Cloudflare KV 配置指南（新界面版）

## 第一步：创建 KV 数据

在您的截图中，我看到了"添加条目"的界面。这里需要：

1. **密钥**（Key）：输入 `test`
2. **值**（Value）：输入 `{"message": "KV is working!"}`
3. 点击 **添加条目** 按钮

但是，我们实际上不需要手动添加数据，Worker会自动写入。

## 第二步：绑定 KV 到 Worker

### 方法1：通过 Worker 设置（推荐）

1. 回到您的 Worker 页面（jiaoben-api）
2. 点击 **Settings** 标签
3. 找到 **Variables** 或 **Bindings** 部分
4. 点击 **Add binding**
5. 选择类型：**KV Namespace**
6. 设置：
   - Variable name: `YUNMAO_RESULTS`
   - KV namespace: 选择您已创建的 `YUNMAO_RESULTS`

### 方法2：在 Worker 代码中绑定

如果上面的方法找不到，可以在 Worker 编辑器中：

1. 点击 Worker 的 **Quick edit**
2. 在代码编辑器顶部，应该有 **Settings** 或 **Environment Variables**
3. 添加 KV 绑定

## 第三步：更新 Worker 代码

使用以下测试代码先验证 KV 是否正确绑定：

```javascript
export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    // 测试 KV 是否正常工作
    if (url.pathname === '/api/kv/test') {
      try {
        // 测试写入
        await env.YUNMAO_RESULTS.put('test_key', JSON.stringify({
          message: 'KV is working!',
          timestamp: new Date().toISOString()
        }));
        
        // 测试读取
        const value = await env.YUNMAO_RESULTS.get('test_key');
        
        return new Response(JSON.stringify({
          success: true,
          kvAvailable: !!env.YUNMAO_RESULTS,
          testValue: value ? JSON.parse(value) : null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // 其他端点保持不变...
    return new Response('Not Found', { status: 404 });
  }
};
```

## 第四步：测试 KV 连接

创建测试页面：

```html
<!DOCTYPE html>
<html>
<head>
    <title>KV 测试</title>
</head>
<body>
    <h1>测试 KV 存储</h1>
    <button onclick="testKV()">测试 KV</button>
    <pre id="result"></pre>
    
    <script>
        async function testKV() {
            try {
                const response = await fetch('https://jiaoben-api.keating8500.workers.dev/api/kv/test');
                const data = await response.json();
                document.getElementById('result').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                document.getElementById('result').textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
```

## 重要提示

1. **KV ID**：我看到您的 KV namespace ID 是 `42d464604c394971a90767258670c06`
2. **确保正确绑定**：Variable name 必须是 `YUNMAO_RESULTS`（与代码中的 `env.YUNMAO_RESULTS` 对应）
3. **权限**：确保 Worker 有读写 KV 的权限

## 如果遇到问题

1. 检查 Worker 的 Settings/Bindings 页面
2. 确认 KV namespace 已经绑定
3. 使用测试代码验证连接
4. 查看 Worker 的实时日志

完成配置后，Worker 就能接收云猫的回调并存储结果了！