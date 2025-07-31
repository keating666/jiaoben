// 测试环境变量加载
const fs = require('fs');
const path = require('path');

// 加载环境变量
function loadEnv() {
  const envPath = path.join(__dirname, 'tech-validation/.env');
  console.log('查找环境变量文件:', envPath);
  
  if (fs.existsSync(envPath)) {
    console.log('✅ 找到 .env 文件');
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
    console.log('✅ 环境变量加载完成');
  } else {
    console.log('❌ 未找到 .env 文件');
  }
}

// 测试加载
console.log('\n=== 加载前 ===');
console.log('YUNMAO_API_KEY:', process.env.YUNMAO_API_KEY || '(未设置)');

loadEnv();

console.log('\n=== 加载后 ===');
console.log('YUNMAO_API_KEY:', process.env.YUNMAO_API_KEY || '(未设置)');
console.log('API Key 长度:', process.env.YUNMAO_API_KEY ? process.env.YUNMAO_API_KEY.length : 0);

// 打印前几个字符（脱敏）
if (process.env.YUNMAO_API_KEY) {
  console.log('API Key 前4位:', process.env.YUNMAO_API_KEY.substring(0, 4) + '...');
}

// 检查其他相关变量
console.log('\n=== 其他环境变量 ===');
console.log('TONGYI_API_KEY:', process.env.TONGYI_API_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('TIKHUB_API_TOKEN:', process.env.TIKHUB_API_TOKEN ? '✅ 已设置' : '❌ 未设置');
console.log('MINIMAX_API_KEY:', process.env.MINIMAX_API_KEY ? '✅ 已设置' : '❌ 未设置');