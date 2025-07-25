#!/usr/bin/env node

/**
 * 部署诊断脚本
 * 详细诊断部署问题
 */

const https = require('https');
const dns = require('dns').promises;

const DOMAIN = 'jiaoben-7jx4.vercel.app';

async function checkDNS() {
  console.log('🔍 检查 DNS 解析...');
  try {
    const addresses = await dns.resolve4(DOMAIN);
    console.log(`✅ DNS 解析成功: ${addresses.join(', ')}`);
    
    // 检查是否是 Vercel 的 IP
    const isVercelIP = addresses.some(ip => 
      ip.startsWith('76.') || ip.startsWith('76.223.')
    );
    
    if (isVercelIP) {
      console.log('✅ IP 地址属于 Vercel\n');
    } else {
      console.log('⚠️  IP 地址可能不属于 Vercel\n');
    }
    
    return true;
  } catch (error) {
    console.log(`❌ DNS 解析失败: ${error.message}\n`);
    return false;
  }
}

async function checkHTTPS() {
  console.log('🔍 检查 HTTPS 连接...');
  
  return new Promise((resolve) => {
    const options = {
      hostname: DOMAIN,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 10000,
    };
    
    const req = https.request(options, (res) => {
      console.log(`✅ HTTPS 连接成功 (状态码: ${res.statusCode})`);
      console.log(`   服务器: ${res.headers.server || '未知'}`);
      console.log(`   x-vercel-id: ${res.headers['x-vercel-id'] || '未找到'}\n`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log(`❌ HTTPS 连接失败: ${err.message}\n`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log('❌ HTTPS 连接超时\n');
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function checkVercelStatus() {
  console.log('🔍 检查 Vercel 状态页...');
  
  try {
    const statusPage = await new Promise((resolve, reject) => {
      https.get('https://www.vercel-status.com/api/v2/status.json', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    
    console.log(`Vercel 状态: ${statusPage.status.description}`);
    console.log(`指示器: ${statusPage.status.indicator}\n`);
    
    return statusPage.status.indicator === 'none';
  } catch (error) {
    console.log('⚠️  无法检查 Vercel 状态\n');
    return true;
  }
}

async function diagnose() {
  console.log('🏥 Vercel 部署诊断工具\n');
  console.log(`目标域名: ${DOMAIN}`);
  console.log(`时间: ${new Date().toISOString()}\n`);
  
  const results = {
    dns: await checkDNS(),
    https: await checkHTTPS(),
    vercelStatus: await checkVercelStatus(),
  };
  
  console.log('📊 诊断结果:');
  
  if (results.dns && results.https && results.vercelStatus) {
    console.log('✅ 所有检查通过！');
    console.log('\n可能的问题:');
    console.log('1. 部署可能还在进行中');
    console.log('2. 需要清除本地 DNS 缓存');
    console.log('3. 检查 Vercel Dashboard 中的部署状态');
  } else {
    console.log('❌ 发现问题！');
    
    if (!results.dns) {
      console.log('\n🔧 DNS 问题解决方案:');
      console.log('1. 检查域名是否正确');
      console.log('2. 等待 DNS 传播（可能需要几分钟）');
      console.log('3. 尝试: nslookup ' + DOMAIN);
    }
    
    if (!results.https) {
      console.log('\n🔧 HTTPS 连接问题解决方案:');
      console.log('1. 检查网络连接');
      console.log('2. 检查防火墙设置');
      console.log('3. 尝试使用 VPN');
    }
    
    if (!results.vercelStatus) {
      console.log('\n🔧 Vercel 服务问题:');
      console.log('1. 访问 https://www.vercel-status.com 查看详情');
      console.log('2. 等待服务恢复');
    }
  }
  
  console.log('\n📚 相关链接:');
  console.log('- GitHub Actions: https://github.com/keating666/jiaoben/actions');
  console.log('- Vercel Dashboard: https://vercel.com/dashboard');
  console.log('- Vercel Status: https://www.vercel-status.com');
}

// 运行诊断
diagnose().catch(console.error);