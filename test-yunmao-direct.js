// 直接测试云猫API
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

// 测试参数
const testVideoUrl = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';

// 准备请求数据
const requestData = JSON.stringify({
  language: 'chinese',
  fileUrl: testVideoUrl,
  notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
  resultType: 'str',
  chat: false
});

console.log('=== 云猫API直接测试 ===');
console.log('API Key:', process.env.YUNMAO_API_KEY ? `${process.env.YUNMAO_API_KEY.substring(0, 4)}...` : '未设置');
console.log('请求数据:', requestData);

const options = {
  hostname: 'api.guangfan.tech',
  path: '/v1/get-text',
  method: 'POST',
  headers: {
    'api-key': process.env.YUNMAO_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData)
  }
};

console.log('\n发送请求到:', `https://${options.hostname}${options.path}`);
console.log('请求头:', options.headers);

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
        console.log('\n✅ 成功！任务ID:', parsed.data);
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

req.write(requestData);
req.end();