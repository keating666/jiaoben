/**
 * Cloudflare Worker v3 - 修复 JSON 解析错误
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
      
      // TikHub 测试端点
      if (url.pathname === '/api/tikhub/test') {
        // 解析请求体
        let body;
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          return new Response(JSON.stringify({
            error: 'Invalid JSON in request body',
            details: e.message
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const douyinUrl = body.douyinUrl || 'https://v.douyin.com/67CMClLwb1c/';
        
        console.log('测试链接:', douyinUrl);
        console.log('Token:', env.TIKHUB_API_TOKEN ? '已设置' : '未设置');
        
        // 构建请求
        const apiUrl = `https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(douyinUrl)}`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${env.TIKHUB_API_TOKEN}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const responseText = await response.text();
        console.log('响应状态:', response.status);
        console.log('响应内容:', responseText);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          return new Response(JSON.stringify({
            error: '响应不是有效的 JSON',
            status: response.status,
            responseText: responseText
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 分析响应
        if (data.code === 0 && data.data) {
          // 成功响应，尝试找到视频 URL
          const videoData = data.data;
          const possiblePaths = [];
          
          // 递归查找所有可能的 URL
          function findUrls(obj, path = '') {
            for (const key in obj) {
              const currentPath = path ? `${path}.${key}` : key;
              if (typeof obj[key] === 'string' && obj[key].includes('http')) {
                possiblePaths.push({
                  path: currentPath,
                  url: obj[key].substring(0, 100) + '...'
                });
              } else if (Array.isArray(obj[key])) {
                obj[key].forEach((item, index) => {
                  if (typeof item === 'string' && item.includes('http')) {
                    possiblePaths.push({
                      path: `${currentPath}[${index}]`,
                      url: item.substring(0, 100) + '...'
                    });
                  }
                });
              } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                findUrls(obj[key], currentPath);
              }
            }
          }
          
          findUrls(videoData);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'TikHub API 调用成功',
            dataStructure: Object.keys(videoData),
            possibleVideoUrls: possiblePaths,
            sampleData: {
              title: videoData.title || videoData.desc || '无标题',
              author: videoData.author?.nickname || videoData.author_user_id || '未知'
            }
          }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } else {
          // 错误响应
          return new Response(JSON.stringify({
            success: false,
            error: 'TikHub API 错误',
            response: data
          }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 完整处理流程
      if (url.pathname === '/api/process') {
        // 解析请求体
        let body;
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : {};
        } catch (e) {
          return new Response(JSON.stringify({
            error: 'Invalid JSON in request body',
            details: e.message
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
        
        // 先调用 TikHub
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
        
        if (tikHubData.code !== 0) {
          return new Response(JSON.stringify({
            success: false,
            step: 'TikHub',
            error: tikHubData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 尝试多种路径提取视频 URL
        let videoUrl = null;
        const data = tikHubData.data;
        
        // 常见路径
        const paths = [
          () => data.video?.play_addr?.url_list?.[0],
          () => data.video?.download_addr?.url_list?.[0],
          () => data.aweme_detail?.video?.play_addr?.url_list?.[0],
          () => data.aweme_detail?.video?.download_addr?.url_list?.[0],
          () => data.video?.play_url,
          () => data.video?.download_url,
          () => data.play_url,
          () => data.download_url,
          () => data.play,
          () => data.download
        ];
        
        for (const pathFn of paths) {
          try {
            const url = pathFn();
            if (url && typeof url === 'string' && url.startsWith('http')) {
              videoUrl = url;
              break;
            }
          } catch (e) {
            // 继续尝试下一个路径
          }
        }
        
        if (!videoUrl) {
          return new Response(JSON.stringify({
            success: false,
            step: 'URL提取',
            error: '无法从 TikHub 响应中提取视频 URL',
            availableKeys: Object.keys(data),
            videoKeys: data.video ? Object.keys(data.video) : []
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用云猫
        const yunmaoResponse = await fetch('https://api.guangfan.tech/v1/get-text', {
          method: 'POST',
          headers: {
            'api-key': env.YUNMAO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            language: 'chinese',
            fileUrl: videoUrl,
            resultType: 'str',
            chat: false
          })
        });
        
        const yunmaoData = await yunmaoResponse.json();
        
        return new Response(JSON.stringify({
          success: yunmaoData.code === 0,
          videoUrl: videoUrl,
          taskId: yunmaoData.data,
          yunmaoResponse: yunmaoData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
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