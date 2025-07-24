#!/usr/bin/env node

/**
 * 验证环境变量配置
 */

const requiredEnvVars = [
  { name: 'MINIMAX_API_KEY', description: 'MiniMax API 密钥' },
  { name: 'MINIMAX_GROUP_ID', description: 'MiniMax 群组 ID' },
  { name: 'TONGYI_API_KEY', description: '通义千问 API 密钥' },
  { name: 'IFLYTEK_API_KEY', description: '讯飞星火 API 密钥' },
  { name: 'IFLYTEK_APP_ID', description: '讯飞应用 ID' },
  { name: 'IFLYTEK_API_SECRET', description: '讯飞 API 密钥' },
];

const optionalEnvVars = [
  { name: 'MINIMAX_API_BASE_URL', description: 'MiniMax API 基础 URL', default: 'https://api.minimax.chat' },
  { name: 'TONGYI_API_BASE_URL', description: '通义千问 API 基础 URL', default: 'https://dashscope.aliyuncs.com' },
  { name: 'IFLYTEK_API_BASE_URL', description: '讯飞 API 基础 URL', default: 'https://iat-api.xfyun.cn' },
  { name: 'API_TIMEOUT', description: 'API 超时时间', default: '30000' },
  { name: 'MAX_RETRIES', description: '最大重试次数', default: '3' },
  { name: 'RETRY_DELAY_BASE', description: '重试延迟基数', default: '1000' },
  { name: 'LOG_LEVEL', description: '日志级别', default: 'info' },
];

console.log('🔍 验证环境变量配置...\n');

let hasError = false;

// 检查必需的环境变量
console.log('必需的环境变量：');
requiredEnvVars.forEach(({ name, description }) => {
  const value = process.env[name];
  if (value) {
    console.log(`✅ ${name} (${description}): 已设置`);
  } else {
    console.log(`❌ ${name} (${description}): 未设置`);
    hasError = true;
  }
});

console.log('\n可选的环境变量：');
optionalEnvVars.forEach(({ name, description, default: defaultValue }) => {
  const value = process.env[name];
  if (value) {
    console.log(`✅ ${name} (${description}): ${value}`);
  } else {
    console.log(`⚠️  ${name} (${description}): 未设置，将使用默认值 ${defaultValue}`);
  }
});

// 显示环境信息
console.log('\n环境信息：');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`Platform: ${process.platform}`);
console.log(`Node Version: ${process.version}`);

if (hasError) {
  console.log('\n❌ 环境变量验证失败！请设置所有必需的环境变量。');
  console.log('\n参考文档：docs/vercel-env-setup.md');
  process.exit(1);
} else {
  console.log('\n✅ 所有必需的环境变量已正确配置！');
  
  // 如果在 Vercel 环境中，显示额外信息
  if (process.env.VERCEL) {
    console.log('\n📍 Vercel 环境检测到：');
    console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV}`);
    console.log(`VERCEL_URL: ${process.env.VERCEL_URL}`);
    console.log(`VERCEL_REGION: ${process.env.VERCEL_REGION}`);
  }
}