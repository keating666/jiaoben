#!/usr/bin/env node

/**
 * 部署验证脚本
 * 检查 Vercel 部署是否成功
 */

const https = require('https');

const DEPLOYMENT_URL = 'https://jiaoben-7jx4.vercel.app';

const endpoints = [
  { path: '/api/ping', expected: 200, name: 'API Ping' },
  { path: '/video-transcribe-dashboard.html', expected: 200, name: '测试页面' },
  { path: '/api/video/transcribe', expected: 405, name: 'Transcribe API (GET应返回405)' },
];

async function checkEndpoint(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode);
    }).on('error', (err) => {
      console.error(`❌ 请求失败: ${err.message}`);
      resolve(0);
    });
  });
}

async function verifyDeployment() {
  console.log('🔍 开始验证部署...\n');
  
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    const url = `${DEPLOYMENT_URL}${endpoint.path}`;
    console.log(`检查: ${endpoint.name}`);
    console.log(`URL: ${url}`);
    
    const status = await checkEndpoint(url);
    
    if (status === endpoint.expected) {
      console.log(`✅ 通过 (状态码: ${status})\n`);
    } else {
      console.log(`❌ 失败 (期望: ${endpoint.expected}, 实际: ${status})\n`);
      allPassed = false;
    }
  }
  
  console.log('📊 验证结果:');
  if (allPassed) {
    console.log('✅ 所有检查都通过！部署成功！');
    
    console.log('\n🎯 下一步:');
    console.log('1. 访问测试页面: ' + DEPLOYMENT_URL + '/video-transcribe-dashboard.html');
    console.log('2. 测试视频转写功能');
    console.log('3. 检查 Vercel 日志: https://vercel.com/dashboard');
  } else {
    console.log('❌ 部分检查失败，请检查部署状态');
    
    console.log('\n🔧 故障排除:');
    console.log('1. 检查 GitHub Actions: https://github.com/keating666/jiaoben/actions');
    console.log('2. 检查 Vercel 部署: https://vercel.com/dashboard');
    console.log('3. 运行手动部署: npm run deploy:manual');
  }
}

// 运行验证
verifyDeployment().catch(console.error);