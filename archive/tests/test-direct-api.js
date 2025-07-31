// 直接测试 API 功能，绕过 TypeScript 编译问题
const https = require('https');
const http = require('http');

// 测试配置
const tests = [
  {
    name: '测试 TikHub API',
    run: async () => {
      console.log('\n测试 TikHub API...');
      const token = process.env.TIKHUB_API_TOKEN;
      if (!token) {
        console.log('❌ 缺少 TIKHUB_API_TOKEN');
        return;
      }
      
      try {
        const response = await makeRequest({
          hostname: 'api.tikhub.io',
          path: '/api/v1/test',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        console.log('✅ TikHub API 连接成功');
        console.log('响应:', response);
      } catch (error) {
        console.log('❌ TikHub API 错误:', error.message);
      }
    }
  },
  {
    name: '测试云猫转码 API',
    run: async () => {
      console.log('\n测试云猫转码 API...');
      const apiKey = process.env.YUNMAO_API_KEY;
      if (!apiKey) {
        console.log('❌ 缺少 YUNMAO_API_KEY');
        return;
      }
      
      try {
        // 云猫 API 测试
        console.log('✅ 云猫 API Key 已配置:', apiKey.substring(0, 8) + '...');
      } catch (error) {
        console.log('❌ 云猫 API 错误:', error.message);
      }
    }
  },
  {
    name: '测试通义千问 API',
    run: async () => {
      console.log('\n测试通义千问 API...');
      const apiKey = process.env.TONGYI_API_KEY;
      if (!apiKey) {
        console.log('❌ 缺少 TONGYI_API_KEY');
        return;
      }
      
      try {
        const response = await makeRequest({
          hostname: 'dashscope.aliyuncs.com',
          path: '/api/v1/services/aigc/text-generation/generation',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'qwen-turbo',
            input: {
              messages: [
                {
                  role: 'user',
                  content: '你好'
                }
              ]
            }
          })
        });
        console.log('✅ 通义千问 API 连接成功');
        console.log('响应:', JSON.stringify(response, null, 2));
      } catch (error) {
        console.log('❌ 通义千问 API 错误:', error.message);
      }
    }
  }
];

// HTTP/HTTPS 请求辅助函数
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const protocol = options.hostname.includes('localhost') ? http : https;
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// 加载环境变量
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, 'tech-validation/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('✅ 已加载环境变量');
}

// 运行测试
async function runTests() {
  console.log('=== API 连接测试 ===\n');
  
  for (const test of tests) {
    await test.run();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=== 测试完成 ===');
}

runTests();