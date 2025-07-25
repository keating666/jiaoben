#!/usr/bin/env node

/**
 * 检查 Vercel 部署 URL
 * 基于截图中的部署 ID
 */

const https = require('https');

// 从截图中看到的部署 URL
const deploymentUrls = [
  'https://jiaoben-2vch8wzkn.vercel.app',  // 最新部署
  'https://jiaoben-6r8mhzfej.vercel.app',  // 8分钟前
  'https://jiaoben-7li4qkhkp.vercel.app',  // 19分钟前
  'https://jiaoben.vercel.app',            // 主域名（如果已配置）
];

async function checkUrl(url) {
  return new Promise((resolve) => {
    console.log(`\n🔍 检查: ${url}`);
    
    https.get(url + '/api/ping', (res) => {
      console.log(`   状态码: ${res.statusCode}`);
      console.log(`   服务器: ${res.headers.server || '未知'}`);
      console.log(`   x-vercel-id: ${res.headers['x-vercel-id'] || '未找到'}`);
      
      if (res.statusCode === 200) {
        console.log(`   ✅ API 可访问！`);
        resolve(true);
      } else {
        console.log(`   ⚠️  API 返回了 ${res.statusCode}`);
        resolve(false);
      }
    }).on('error', (err) => {
      console.log(`   ❌ 错误: ${err.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('🚀 Vercel 部署 URL 检查工具');
  console.log('================================');
  
  let workingUrl = null;
  
  for (const url of deploymentUrls) {
    const isWorking = await checkUrl(url);
    if (isWorking && !workingUrl) {
      workingUrl = url;
    }
  }
  
  console.log('\n📊 检查结果:');
  if (workingUrl) {
    console.log(`✅ 找到可用的部署: ${workingUrl}`);
    console.log(`\n🎯 测试页面 URL:`);
    console.log(`${workingUrl}/video-transcribe-dashboard.html`);
    console.log(`\n📝 API 端点:`);
    console.log(`POST ${workingUrl}/api/video/transcribe`);
  } else {
    console.log('❌ 没有找到可用的部署');
    console.log('\n建议检查:');
    console.log('1. Vercel Dashboard: https://vercel.com/dashboard');
    console.log('2. 项目设置中的域名配置');
  }
}

main().catch(console.error);