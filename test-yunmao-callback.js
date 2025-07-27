const https = require('https');

// 测试云猫回调功能
async function testYunmaoCallback() {
  console.log('🚀 测试云猫回调集成...\n');
  
  // 步骤1：创建一个测试任务
  console.log('=== 步骤1：调用 transcribe-v3-simple API ===');
  
  const testData = JSON.stringify({
    videoUrl: 'https://test.example.com/video.mp4',
    style: 'professional'
  });
  
  const transcribeOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/video/transcribe-v3-simple',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-api-key-123',
      'Content-Length': Buffer.byteLength(testData)
    }
  };
  
  console.log('发送转录请求...');
  
  // 这里应该发送请求，但为了演示，我们模拟一个任务ID
  const mockTaskId = `test_${Date.now()}`;
  console.log('模拟任务ID:', mockTaskId);
  
  // 步骤2：模拟云猫回调
  console.log('\n=== 步骤2：模拟云猫回调 ===');
  
  // 等待几秒后模拟回调
  setTimeout(() => {
    console.log('模拟云猫回调通知...');
    
    const callbackData = JSON.stringify({
      taskId: mockTaskId,
      code: 0,
      data: '这是从视频中提取的文本内容。视频展示了一个有趣的场景，包含了多个精彩片段。',
      message: 'success'
    });
    
    const callbackOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/yunmao-callback',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(callbackData)
      }
    };
    
    const req = https.request(callbackOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('回调响应:', res.statusCode, data);
        
        // 步骤3：查询结果
        setTimeout(() => {
          console.log('\n=== 步骤3：查询任务结果 ===');
          queryResult(mockTaskId);
        }, 1000);
      });
    });
    
    req.on('error', (error) => {
      console.error('回调请求失败:', error.message);
    });
    
    req.write(callbackData);
    req.end();
  }, 3000);
}

// 查询任务结果
function queryResult(taskId) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: `/api/yunmao-result/${taskId}`,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('查询结果响应:', res.statusCode);
      try {
        const result = JSON.parse(data);
        console.log('任务结果:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('原始响应:', data);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('查询请求失败:', error.message);
  });
  
  req.end();
}

// 使用说明
console.log('云猫回调测试说明:');
console.log('1. 需要先启动本地服务器: node test-server-simple.js');
console.log('2. 本测试会模拟完整的回调流程');
console.log('3. 实际使用时，云猫会自动调用回调端点\n');
console.log('注意：如果看到连接错误，请确保本地服务器已启动\n');

// 运行测试
testYunmaoCallback();