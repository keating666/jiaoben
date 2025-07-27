# 云猫（广帆）API 回调实现指南

## 概述

云猫（广帆）转文字 API 使用异步处理模式，需要提供回调端点来接收处理结果。

## 回调端点实现

### 1. 创建回调端点

```javascript
// /api/yunmao-callback.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 接收回调数据
    const { taskId, code, data, message } = req.body;
    
    console.log('收到云猫回调:', {
      taskId,
      code,
      message,
      dataType: typeof data
    });

    if (code === 0) {
      // 成功
      // 这里应该将结果存储到数据库或缓存中
      // 以便原始请求可以查询到结果
      
      // 示例：存储到内存缓存（生产环境应使用 Redis 等）
      global.yunmaoResults = global.yunmaoResults || {};
      global.yunmaoResults[taskId] = {
        status: 'completed',
        text: data, // 如果 resultType 是 'str'
        fileUrl: data, // 如果 resultType 是 'txt'
        completedAt: new Date().toISOString()
      };
    } else {
      // 失败
      global.yunmaoResults = global.yunmaoResults || {};
      global.yunmaoResults[taskId] = {
        status: 'failed',
        error: message,
        completedAt: new Date().toISOString()
      };
    }

    // 返回成功响应
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('处理云猫回调失败:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 2. 查询任务结果端点

```javascript
// /api/yunmao-result/[taskId].js
export default async function handler(req, res) {
  const { taskId } = req.query;

  if (!taskId) {
    return res.status(400).json({ error: 'Missing taskId' });
  }

  // 从缓存中获取结果
  const result = global.yunmaoResults?.[taskId];

  if (!result) {
    return res.status(404).json({ 
      error: 'Result not found',
      status: 'pending'
    });
  }

  res.status(200).json(result);
}
```

### 3. 修改主处理流程

```javascript
// 在 transcribe-v3-simple.js 中
async function callYunmao(videoUrl) {
  // 1. 创建任务
  const taskId = await createYunmaoTask(videoUrl);
  
  // 2. 轮询结果
  const result = await pollYunmaoResult(taskId, {
    maxWaitTime: 300000, // 5分钟
    pollInterval: 5000   // 5秒
  });
  
  return result.text;
}

async function pollYunmaoResult(taskId, options) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < options.maxWaitTime) {
    try {
      // 查询结果
      const response = await fetch(
        `https://jiaoben-7jx4.vercel.app/api/yunmao-result/${taskId}`
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'completed') {
          return result;
        } else if (result.status === 'failed') {
          throw new Error(result.error);
        }
      }
    } catch (error) {
      console.log('查询结果失败，继续等待');
    }
    
    // 等待后继续
    await new Promise(resolve => setTimeout(resolve, options.pollInterval));
  }
  
  throw new Error('等待超时');
}
```

## 生产环境建议

1. **使用持久化存储**
   - Redis 或其他缓存数据库
   - 设置合理的过期时间（如 1 小时）

2. **安全性**
   - 验证回调请求来源
   - 可以使用签名验证机制

3. **可靠性**
   - 实现重试机制
   - 记录所有回调日志

4. **监控**
   - 监控任务完成率
   - 设置超时告警

## 部署注意事项

1. 确保回调 URL 公网可访问
2. 配置合理的超时时间（Vercel 函数最长 60 秒）
3. 考虑使用队列服务处理长时间任务