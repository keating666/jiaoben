// 简化的 transcribe-v3 测试 - 直接调用各个服务
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载环境变量
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

// 简化的 API 流程测试
async function testTranscribeFlow() {
  console.log('=== 测试 Transcribe V3 流程 ===\n');
  
  const testUrl = 'https://v.douyin.com/iRyLb8kf/';
  
  // 步骤 1: 从文本中提取链接（模拟）
  console.log('步骤 1: 提取抖音链接');
  console.log('输入文本: "看这个视频 ' + testUrl + ' 太好笑了"');
  console.log('提取的链接:', testUrl);
  
  // 步骤 2: 使用 TikHub 解析视频地址（模拟）
  console.log('\n步骤 2: 解析视频地址 (TikHub)');
  if (process.env.TIKHUB_API_TOKEN) {
    console.log('✅ TikHub Token 已配置');
    console.log('模拟解析结果: https://v26-web.douyinvod.com/example.mp4');
  } else {
    console.log('❌ TikHub Token 未配置');
    console.log('降级到直接使用原始 URL');
  }
  
  // 步骤 3: 使用云猫转文字（模拟）
  console.log('\n步骤 3: 视频转文字 (云猫)');
  if (process.env.YUNMAO_API_KEY) {
    console.log('✅ 云猫 API Key 已配置');
    console.log('模拟转录结果: "这是一个测试视频的文字内容..."');
  } else {
    console.log('❌ 云猫 API Key 未配置');
    console.log('降级到 MiniMax 或模拟数据');
  }
  
  // 步骤 4: 使用通义千问生成脚本
  console.log('\n步骤 4: 生成脚本 (通义千问)');
  if (process.env.TONGYI_API_KEY) {
    console.log('✅ 通义千问 API Key 已配置');
    
    try {
      // 实际调用通义千问 API
      const response = await callTongyi('根据以下视频内容生成分镜头脚本：这是一个测试视频的文字内容...');
      console.log('生成的脚本:', response);
    } catch (error) {
      console.log('调用失败，使用模拟脚本');
      console.log('模拟脚本: { title: "测试视频", scenes: [...] }');
    }
  } else {
    console.log('❌ 通义千问 API Key 未配置');
  }
  
  console.log('\n=== 流程测试完成 ===');
}

// 调用通义千问
function callTongyi(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'qwen-turbo',
      input: {
        messages: [
          {
            role: 'system',
            content: '你是一个专业的视频脚本编辑，请根据视频内容生成分镜头脚本。'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      }
    });
    
    const options = {
      hostname: 'dashscope.aliyuncs.com',
      path: '/api/v1/services/aigc/text-generation/generation',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TONGYI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.output && parsed.output.text) {
            resolve(parsed.output.text);
          } else if (parsed.output && parsed.output.choices) {
            resolve(parsed.output.choices[0].message.content);
          } else {
            resolve('API 返回格式未知');
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 运行测试
testTranscribeFlow();