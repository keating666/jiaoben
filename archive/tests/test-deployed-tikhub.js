const https = require('https');

/**
 * 测试已部署的香港服务器上的 API
 */
async function testDeployedAPI() {
  const testUrl = 'https://v.douyin.com/iRyBWfGS/';
  
  console.log('🧪 测试已部署的 API (香港区域)...');
  console.log('测试URL:', testUrl);
  console.log('---');
  
  // 调用部署的 API
  const apiData = JSON.stringify({ douyinUrl: testUrl });
  
  const options = {
    hostname: 'jiaoben-7jx4.vercel.app',
    path: '/api/douyin/complete-process',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(apiData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log('响应状态码:', res.statusCode);
      console.log('响应头:', res.headers);
      console.log('---');
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('API响应:', JSON.stringify(parsed, null, 2));
          
          if (parsed.success) {
            console.log('\n✅ 任务创建成功');
            console.log('任务ID:', parsed.taskId);
            console.log('SSE监听地址:', parsed.sseUrl);
            
            // 监听SSE进度
            console.log('\n开始监听SSE进度...');
            listenSSE(parsed.sseUrl);
          } else {
            console.log('\n❌ API返回错误:', parsed.error);
          }
          
        } catch (error) {
          console.error('解析错误:', error);
          console.log('原始响应:', data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('请求错误:', error);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      console.error('请求超时');
    });
    
    req.write(apiData);
    req.end();
  });
}

// 监听SSE进度
function listenSSE(sseUrl) {
  const url = new URL('https://jiaoben-7jx4.vercel.app' + sseUrl);
  
  https.get(url, (res) => {
    console.log('SSE连接状态码:', res.statusCode);
    
    res.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      lines.forEach(line => {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            
            if (data.type === 'update') {
              console.log(`[更新] 当前步骤: ${data.currentStep}, 状态: ${data.status}`);
              if (data.steps) {
                data.steps.forEach(step => {
                  console.log(`  - ${step.name}: ${step.status} ${step.progress || ''}`);
                });
              }
            } else if (data.type === 'final') {
              console.log('\n[完成] 最终状态:', data.status);
              if (data.result) {
                console.log('视频URL:', data.result.videoUrl);
                console.log('转录文本长度:', data.result.transcript?.length || 0);
                console.log('脚本生成:', data.result.script ? '成功' : '失败');
              }
              if (data.error) {
                console.log('错误信息:', data.error);
              }
              process.exit(0);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      });
    });
  }).on('error', (error) => {
    console.error('SSE连接错误:', error);
  });
}

// 运行测试
testDeployedAPI();