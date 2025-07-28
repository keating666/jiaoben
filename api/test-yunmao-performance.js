const https = require('https');

// 性能测试端点
async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] 云猫性能测试`);
  
  // 设置CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const tests = [];
  const startTime = Date.now();
  
  // 测试1: API连通性
  const apiTest = await testApiConnectivity();
  tests.push(apiTest);
  
  // 测试2: 提交小任务
  const smallTaskTest = await testSmallTask();
  tests.push(smallTaskTest);
  
  // 测试3: 网络延迟
  const latencyTest = await testLatency();
  tests.push(latencyTest);
  
  const totalTime = Date.now() - startTime;
  
  res.status(200).json({
    success: true,
    totalTime: `${totalTime}ms`,
    tests,
    recommendations: generateRecommendations(tests)
  });
}

// 测试API连通性
async function testApiConnectivity() {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.guangfan.tech',
      path: '/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      const time = Date.now() - startTime;
      resolve({
        name: 'API连通性',
        status: res.statusCode < 400 ? 'pass' : 'fail',
        time: `${time}ms`,
        details: `状态码: ${res.statusCode}`
      });
    });
    
    req.on('error', (error) => {
      resolve({
        name: 'API连通性',
        status: 'fail',
        time: `${Date.now() - startTime}ms`,
        details: error.message
      });
    });
    
    req.on('timeout', () => {
      resolve({
        name: 'API连通性',
        status: 'timeout',
        time: '5000ms',
        details: '连接超时'
      });
    });
    
    req.end();
  });
}

// 测试提交小任务
async function testSmallTask() {
  const startTime = Date.now();
  
  // 使用一个极小的音频文件URL
  const testUrl = 'https://www.w3schools.com/html/horse.ogg';
  
  return new Promise((resolve) => {
    const requestData = JSON.stringify({
      language: 'chinese',
      fileUrl: testUrl,
      resultType: 'str',
      chat: false
    });
    
    const options = {
      hostname: 'api.guangfan.tech',
      path: '/v1/get-text',
      method: 'POST',
      headers: {
        'api-key': process.env.YUNMAO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      },
      timeout: 10000
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        const time = Date.now() - startTime;
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            name: '提交任务响应',
            status: parsed.code === 0 ? 'pass' : 'fail',
            time: `${time}ms`,
            details: parsed.code === 0 ? `任务ID: ${parsed.data}` : parsed.message
          });
        } catch (e) {
          resolve({
            name: '提交任务响应',
            status: 'error',
            time: `${time}ms`,
            details: '响应解析失败'
          });
        }
      });
    });
    
    req.on('error', (error) => {
      resolve({
        name: '提交任务响应',
        status: 'error',
        time: `${Date.now() - startTime}ms`,
        details: error.message
      });
    });
    
    req.write(requestData);
    req.end();
  });
}

// 测试网络延迟
async function testLatency() {
  const urls = [
    { name: '云猫API', host: 'api.guangfan.tech' },
    { name: '测试视频CDN', host: 'sample-videos.com' },
    { name: 'W3Schools CDN', host: 'www.w3schools.com' }
  ];
  
  const results = [];
  
  for (const url of urls) {
    const startTime = Date.now();
    const result = await new Promise((resolve) => {
      const options = {
        hostname: url.host,
        path: '/',
        method: 'HEAD',
        timeout: 3000
      };
      
      const req = https.request(options, (res) => {
        resolve({
          host: url.name,
          time: Date.now() - startTime,
          status: 'ok'
        });
      });
      
      req.on('error', () => {
        resolve({
          host: url.name,
          time: Date.now() - startTime,
          status: 'error'
        });
      });
      
      req.on('timeout', () => {
        resolve({
          host: url.name,
          time: 3000,
          status: 'timeout'
        });
      });
      
      req.end();
    });
    
    results.push(result);
  }
  
  return {
    name: '网络延迟测试',
    status: 'info',
    time: '-',
    details: results
  };
}

// 生成优化建议
function generateRecommendations(tests) {
  const recommendations = [];
  
  // 检查API连通性
  const apiTest = tests.find(t => t.name === 'API连通性');
  if (apiTest && apiTest.status !== 'pass') {
    recommendations.push('云猫API连接有问题，请检查网络或API状态');
  }
  
  // 检查响应时间
  const submitTest = tests.find(t => t.name === '提交任务响应');
  if (submitTest && parseInt(submitTest.time) > 5000) {
    recommendations.push('API响应时间过长，建议：使用国内CDN的视频、减小视频大小');
  }
  
  // 检查网络延迟
  const latencyTest = tests.find(t => t.name === '网络延迟测试');
  if (latencyTest && latencyTest.details) {
    const slowHosts = latencyTest.details.filter(h => h.time > 1000);
    if (slowHosts.length > 0) {
      recommendations.push(`以下服务延迟较高: ${slowHosts.map(h => h.host).join(', ')}`);
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('性能正常，如果仍然慢，可能是视频文件过大或云猫服务器负载高');
  }
  
  return recommendations;
}

module.exports = handler;