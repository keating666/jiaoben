/**
 * Cloudflare Worker v4 - 修复 TikHub API 响应处理
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
        console.log('响应内容长度:', responseText.length);
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (e) {
          return new Response(JSON.stringify({
            error: '响应不是有效的 JSON',
            status: response.status,
            responseText: responseText.substring(0, 500) + '...'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 分析响应 - 修正判断条件
        if (data.code === 200 && data.data) {
          // 成功响应，尝试找到视频 URL
          const videoData = data.data;
          const possiblePaths = [];
          
          // 递归查找所有可能的 URL
          function findUrls(obj, path = '') {
            for (const key in obj) {
              if (obj[key] === null || obj[key] === undefined) continue;
              
              const currentPath = path ? `${path}.${key}` : key;
              
              if (typeof obj[key] === 'string' && obj[key].includes('http')) {
                possiblePaths.push({
                  path: currentPath,
                  url: obj[key].substring(0, 150) + (obj[key].length > 150 ? '...' : '')
                });
              } else if (Array.isArray(obj[key])) {
                obj[key].forEach((item, index) => {
                  if (typeof item === 'string' && item.includes('http')) {
                    possiblePaths.push({
                      path: `${currentPath}[${index}]`,
                      url: item.substring(0, 150) + (item.length > 150 ? '...' : '')
                    });
                  } else if (typeof item === 'object' && item !== null) {
                    findUrls(item, `${currentPath}[${index}]`);
                  }
                });
              } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                findUrls(obj[key], currentPath);
              }
            }
          }
          
          findUrls(videoData);
          
          // 查找视频相关信息
          const videoInfo = {};
          const aweme = videoData.aweme_detail;
          
          if (aweme) {
            videoInfo.title = aweme.desc || aweme.share_info?.share_title || '无标题';
            videoInfo.author = aweme.author?.nickname || aweme.author?.unique_id || '未知作者';
            videoInfo.videoId = aweme.aweme_id || aweme.video?.vid || '未知ID';
            
            // 查找视频URL
            if (aweme.video?.play_addr?.url_list?.length > 0) {
              videoInfo.playUrl = aweme.video.play_addr.url_list[0];
            } else if (aweme.video?.download_addr?.url_list?.length > 0) {
              videoInfo.downloadUrl = aweme.video.download_addr.url_list[0];
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: 'TikHub API 调用成功',
            videoInfo: videoInfo,
            dataStructure: Object.keys(videoData),
            awemeDetailKeys: aweme ? Object.keys(aweme) : [],
            videoKeys: aweme?.video ? Object.keys(aweme.video) : [],
            possibleVideoUrls: possiblePaths.filter(p => 
              p.path.includes('video') || 
              p.path.includes('play') || 
              p.path.includes('download')
            ),
            allUrls: possiblePaths
          }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } else {
          // 错误响应
          return new Response(JSON.stringify({
            success: false,
            error: 'TikHub API 错误',
            code: data.code,
            message: data.msg || data.message || '未知错误',
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
        
        if (tikHubData.code !== 200) {
          return new Response(JSON.stringify({
            success: false,
            step: 'TikHub',
            error: tikHubData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 尝试提取视频 URL
        let videoUrl = null;
        const aweme = tikHubData.data?.aweme_detail;
        
        if (aweme?.video) {
          // 优先使用 play_addr
          if (aweme.video.play_addr?.url_list?.length > 0) {
            videoUrl = aweme.video.play_addr.url_list[0];
          }
          // 其次使用 download_addr
          else if (aweme.video.download_addr?.url_list?.length > 0) {
            videoUrl = aweme.video.download_addr.url_list[0];
          }
          // 尝试其他字段
          else if (aweme.video.play_url) {
            videoUrl = aweme.video.play_url;
          }
          else if (aweme.video.download_url) {
            videoUrl = aweme.video.download_url;
          }
        }
        
        if (!videoUrl) {
          return new Response(JSON.stringify({
            success: false,
            step: 'URL提取',
            error: '无法从 TikHub 响应中提取视频 URL',
            availableKeys: aweme ? Object.keys(aweme) : [],
            videoKeys: aweme?.video ? Object.keys(aweme.video) : [],
            debugInfo: {
              hasAwemeDetail: !!aweme,
              hasVideo: !!aweme?.video,
              hasPlayAddr: !!aweme?.video?.play_addr,
              hasDownloadAddr: !!aweme?.video?.download_addr
            }
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
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID'
          },
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