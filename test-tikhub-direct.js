const https = require('https');
require('dotenv').config();

/**
 * 直接测试TikHub API，验证返回的数据格式
 */
async function testTikHub() {
  const testUrl = 'https://v.douyin.com/iRyBWfGS/';
  
  console.log('🧪 开始测试TikHub API...');
  console.log('测试URL:', testUrl);
  console.log('API Token:', process.env.TIKHUB_API_KEY ? '✅ 已设置' : '❌ 未设置');
  console.log('---');
  
  const options = {
    hostname: 'api.tikhub.io',
    path: `/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(testUrl)}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.TIKHUB_API_KEY}`,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.get(options, (res) => {
      let data = '';
      
      console.log('响应状态码:', res.statusCode);
      console.log('响应头:', res.headers);
      console.log('---');
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log('API响应:', JSON.stringify(parsed, null, 2));
          
          // 尝试提取视频URL
          if (parsed.code === 0 && parsed.data) {
            console.log('\n✅ API调用成功');
            
            const video = parsed.data.video || parsed.data;
            console.log('\n检查可能的视频URL字段:');
            
            // 检查各种可能的字段
            const possibleFields = [
              'play_addr',
              'download_addr',
              'play',
              'download',
              'video_url',
              'url'
            ];
            
            possibleFields.forEach(field => {
              if (video[field]) {
                console.log(`\n${field}:`, video[field]);
                
                // 如果是对象，尝试提取url_list
                if (video[field].url_list) {
                  console.log(`  url_list:`, video[field].url_list);
                }
              }
            });
            
            // 打印所有字段名
            console.log('\n所有视频对象字段:', Object.keys(video));
          } else {
            console.log('\n❌ API返回错误:', parsed);
          }
          
        } catch (error) {
          console.error('解析错误:', error);
          console.log('原始响应:', data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('请求错误:', error);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      console.error('请求超时');
    });
  });
}

// 运行测试
testTikHub();