/**
 * Cloudflare Worker 快速修复版 - 修复云猫参数问题
 */

export default {
  async fetch(request, env) {
    // CORS 头
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    
    try {
      // 测试端点
      if (url.pathname === '/api/test') {
        return new Response(JSON.stringify({
          success: true,
          region: request.cf?.colo || 'unknown',
          country: request.cf?.country || 'unknown',
          city: request.cf?.city || 'unknown',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 完整处理流程 - 修复版
      if (url.pathname === '/api/process' || url.pathname === '/api/process/smart') {
        let body;
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          return new Response(JSON.stringify({
            error: 'Invalid JSON in request body'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const douyinUrl = body.douyinUrl;
        if (!douyinUrl) {
          return new Response(JSON.stringify({
            error: 'Missing douyinUrl parameter'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('处理抖音链接:', douyinUrl);
        
        // 步骤1: 调用 TikHub
        const tikHubResponse = await fetch(
          `https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(douyinUrl)}`,
          {
            headers: {
              'Authorization': `Bearer ${env.TIKHUB_API_TOKEN}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const tikHubData = await tikHubResponse.json();
        console.log('TikHub 响应代码:', tikHubData.code);
        
        if (tikHubData.code !== 200) {
          return new Response(JSON.stringify({
            success: false,
            step: 'TikHub',
            error: tikHubData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 提取视频URL
        let videoUrl = null;
        const aweme = tikHubData.data?.aweme_detail;
        
        if (aweme?.video?.play_addr?.url_list?.[0]) {
          videoUrl = aweme.video.play_addr.url_list[0];
        } else if (aweme?.video?.download_addr?.url_list?.[0]) {
          videoUrl = aweme.video.download_addr.url_list[0];
        }
        
        if (!videoUrl) {
          return new Response(JSON.stringify({
            success: false,
            step: 'URL提取',
            error: '无法从 TikHub 响应中提取视频 URL'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('提取的视频URL:', videoUrl);
        
        // 步骤2: 调用云猫 - 修复参数问题
        const yunmaoPayload = {
          language: 'chinese',
          fileUrl: videoUrl,
          resultType: 'str',
          chat: false
        };
        
        console.log('云猫请求参数:', JSON.stringify(yunmaoPayload));
        
        const yunmaoResponse = await fetch('https://api.guangfan.tech/v1/get-text', {
          method: 'POST',
          headers: {
            'api-key': env.YUNMAO_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(yunmaoPayload)
        });
        
        const yunmaoText = await yunmaoResponse.text();
        console.log('云猫原始响应:', yunmaoText);
        
        let yunmaoData;
        try {
          yunmaoData = JSON.parse(yunmaoText);
        } catch (e) {
          return new Response(JSON.stringify({
            success: false,
            step: '云猫响应解析',
            error: '云猫返回的不是有效的JSON',
            responseText: yunmaoText
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 处理云猫响应
        const isSuccess = yunmaoData.code === 0 || yunmaoData.code === 200;
        
        return new Response(JSON.stringify({
          success: isSuccess,
          videoUrl: videoUrl,
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID'
          },
          taskId: yunmaoData.data || yunmaoData.taskId || null,
          yunmaoResponse: yunmaoData,
          message: isSuccess ? '视频已提交转文字处理' : '云猫处理失败',
          debug: {
            apiKeyPresent: !!env.YUNMAO_API_KEY,
            payloadSent: yunmaoPayload
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // TikHub 测试端点
      if (url.pathname === '/api/tikhub/test') {
        let body;
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          body = {};
        }
        
        const douyinUrl = body.douyinUrl || 'https://v.douyin.com/67CMClLwb1c/';
        
        const response = await fetch(
          `https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(douyinUrl)}`,
          {
            headers: {
              'Authorization': `Bearer ${env.TIKHUB_API_TOKEN}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const data = await response.json();
        
        if (data.code === 200 && data.data) {
          const aweme = data.data.aweme_detail;
          const videoInfo = {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID',
            playUrl: aweme?.video?.play_addr?.url_list?.[0] || null
          };
          
          // 查找音频URL
          const audioUrls = [];
          if (data.data) {
            const findAudioUrls = (obj, path = '') => {
              for (const key in obj) {
                if (obj[key] === null || obj[key] === undefined) continue;
                const currentPath = path ? `${path}.${key}` : key;
                if (typeof obj[key] === 'string' && obj[key].includes('.mp3')) {
                  audioUrls.push({
                    path: currentPath,
                    url: obj[key],
                    type: currentPath.includes('music') ? '背景音乐' : '可能包含人声'
                  });
                }
              }
            };
            findAudioUrls(data.data);
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: 'TikHub API 调用成功',
            videoInfo: videoInfo,
            audioUrls: audioUrls,
            recommendation: audioUrls.filter(a => !a.path.includes('music')).length > 0 ?
              '发现非音乐音频文件，可能包含人声' :
              '只找到背景音乐，人声可能在视频文件中'
          }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'TikHub API 错误',
            response: data
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error('Worker 错误:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};