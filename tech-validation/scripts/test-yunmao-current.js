const https = require('https');

// 测试配置
const API_KEY = process.env.YUNMAO_API_KEY || '';
const TEST_VIDEO_URL = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';

console.log('🧪 云猫API当前状态测试');
console.log('='.repeat(60));
console.log(`测试时间: ${new Date().toISOString()}`);
console.log(`API Key配置: ${API_KEY ? '✅ 已配置' : '❌ 未配置'}`);
console.log(`测试视频: ${TEST_VIDEO_URL}\n`);

// 提交任务
async function submitTask() {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      language: 'chinese',
      fileUrl: TEST_VIDEO_URL,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
      resultType: 'str',
      chat: false
    });

    const options = {
      hostname: 'api.guangfan.tech',
      path: '/v1/get-text',
      method: 'POST',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };

    console.log('📤 提交任务到云猫API...');
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`响应状态码: ${res.statusCode}`);
        console.log(`响应数据: ${responseData}\n`);
        
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.code === 0) {
            console.log('✅ 任务提交成功！');
            console.log(`任务ID: ${parsed.data}`);
            resolve(parsed.data);
          } else {
            console.log('❌ 任务提交失败');
            console.log(`错误码: ${parsed.code}`);
            console.log(`错误信息: ${parsed.message}`);
            reject(new Error(parsed.message));
          }
        } catch (error) {
          console.log('❌ 解析响应失败');
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ 请求失败:', error.message);
      reject(error);
    });

    req.write(requestData);
    req.end();
  });
}

// 查询任务状态
async function checkStatus(taskId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.guangfan.tech',
      path: `/v1/get-status?id=${encodeURIComponent(taskId)}`,
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    };

    console.log('🔍 查询任务状态...');
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`响应状态码: ${res.statusCode}`);
        console.log(`响应数据: ${responseData}\n`);
        
        try {
          const parsed = JSON.parse(responseData);
          
          if (parsed.code === 0) {
            console.log('✅ 任务完成！');
            console.log(`转录文本: ${parsed.data.substring(0, 200)}...`);
            resolve(parsed.data);
          } else if (parsed.code === 6001 || parsed.code === 1001) {
            console.log('⏳ 任务处理中...');
            console.log(`状态码: ${parsed.code}`);
            console.log(`消息: ${parsed.message}`);
            resolve(null); // 表示还在处理中
          } else {
            console.log('❌ 查询失败');
            console.log(`错误码: ${parsed.code}`);
            console.log(`错误信息: ${parsed.message}`);
            reject(new Error(parsed.message));
          }
        } catch (error) {
          console.log('❌ 解析响应失败');
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ 请求失败:', error.message);
      reject(error);
    });

    req.end();
  });
}

// 主测试流程
async function runTest() {
  try {
    // 步骤1: 提交任务
    console.log('=== 步骤1: 提交任务 ===\n');
    const taskId = await submitTask();
    
    // 步骤2: 等待并查询状态
    console.log('\n=== 步骤2: 查询任务状态 ===\n');
    
    let attempts = 0;
    const maxAttempts = 12; // 最多查询12次（60秒）
    let result = null;
    
    while (attempts < maxAttempts && !result) {
      attempts++;
      console.log(`第 ${attempts} 次查询 (${attempts * 5}秒)`);
      
      // 等待5秒
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      try {
        result = await checkStatus(taskId);
      } catch (error) {
        console.log('查询出错，继续尝试...');
      }
    }
    
    if (result) {
      console.log('\n🎉 测试成功！云猫API工作正常');
      console.log(`文本长度: ${result.length} 字符`);
    } else {
      console.log('\n⚠️  任务仍在处理中，可能需要更长时间');
    }
    
  } catch (error) {
    console.log('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 测试API可用性
async function testApiAvailability() {
  console.log('=== API可用性测试 ===\n');
  
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.guangfan.tech',
      path: '/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = https.request(options, (res) => {
      console.log(`API健康检查响应: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (error) => {
      console.log('API不可达:', error.message);
      resolve(false);
    });
    
    req.end();
  });
}

// 执行测试
async function main() {
  // 先测试API可用性
  const isAvailable = await testApiAvailability();
  
  if (!API_KEY) {
    console.log('\n❌ 错误: 未配置YUNMAO_API_KEY环境变量');
    console.log('请设置: export YUNMAO_API_KEY="your-api-key"');
    process.exit(1);
  }
  
  console.log('\n开始云猫API功能测试...\n');
  await runTest();
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成！');
}

// 运行
main().catch(console.error);