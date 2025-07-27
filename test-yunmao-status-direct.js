// 直接测试云猫状态查询API
const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载环境变量
function loadEnv() {
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
  }
}

loadEnv();

// 从命令行获取任务ID
const taskId = process.argv[2];

if (!taskId) {
  console.log('用法: node test-yunmao-status-direct.js <taskId>');
  console.log('示例: node test-yunmao-status-direct.js empSdofJ3Nav9jxN');
  process.exit(1);
}

console.log('=== 云猫状态查询测试 ===');
console.log('任务ID:', taskId);
console.log('API Key:', process.env.YUNMAO_API_KEY ? `${process.env.YUNMAO_API_KEY.substring(0, 4)}...` : '未设置');

const options = {
  hostname: 'api.guangfan.tech',
  path: `/v1/get-status?id=${encodeURIComponent(taskId)}`,
  method: 'GET',
  headers: {
    'api-key': process.env.YUNMAO_API_KEY,
    'Content-Type': 'application/json'
  }
};

console.log('\n发送请求到:', `https://${options.hostname}${options.path}`);

const req = https.request(options, (res) => {
  let responseData = '';
  
  console.log('\n响应状态码:', res.statusCode);
  console.log('响应头:', res.headers);
  
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    console.log('\n响应内容:', responseData);
    
    try {
      const parsed = JSON.parse(responseData);
      console.log('\n解析后的响应:');
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.code === 0) {
        console.log('\n✅ 任务完成！');
        console.log('转录文本:', parsed.data ? parsed.data.substring(0, 100) + '...' : '(空)');
      } else if (parsed.code === 6001) {
        console.log('\n⏳ 任务处理中...');
      } else if (parsed.code === 1001) {
        console.log('\n⏳ 任务等待处理...');
      } else {
        console.log('\n❌ 错误:', parsed.message, '(代码:', parsed.code, ')');
      }
    } catch (error) {
      console.error('\n解析响应失败:', error);
    }
  });
});

req.on('error', (error) => {
  console.error('\n请求失败:', error);
});

req.end();