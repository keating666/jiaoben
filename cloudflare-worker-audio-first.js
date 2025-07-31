/**
 * Cloudflare Worker - 优先使用音频文件
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
          message: 'Worker正常运行',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 分析所有URL
      if (url.pathname === '/api/analyze') {
        const body = await request.json();
        const douyinUrl = body.douyinUrl;
        
        if (!douyinUrl) {
          return new Response(JSON.stringify({
            error: 'Missing douyinUrl parameter'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用 TikHub
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
            error: 'TikHub API错误',
            details: tikHubData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 收集所有媒体URL
        const mediaUrls = [];
        const data = tikHubData.data;
        
        // 递归查找所有URL
        function findUrls(obj, path = '') {
          for (const key in obj) {
            if (obj[key] === null || obj[key] === undefined) continue;
            
            const currentPath = path ? `${path}.${key}` : key;
            
            if (typeof obj[key] === 'string' && obj[key].includes('http')) {
              // 判断文件类型
              let fileType = 'unknown';
              const urlLower = obj[key].toLowerCase();
              
              if (urlLower.includes('.mp3') || urlLower.includes('music')) {
                fileType = 'audio';
              } else if (urlLower.includes('.mp4') || urlLower.includes('video')) {
                fileType = 'video';
              }
              
              mediaUrls.push({
                path: currentPath,
                url: obj[key],
                length: obj[key].length,
                type: fileType,
                isShort: obj[key].length <= 200
              });
            } else if (Array.isArray(obj[key])) {
              obj[key].forEach((item, index) => {
                if (typeof item === 'string' && item.includes('http')) {
                  let fileType = 'unknown';
                  const urlLower = item.toLowerCase();
                  
                  if (urlLower.includes('.mp3') || urlLower.includes('music')) {
                    fileType = 'audio';
                  } else if (urlLower.includes('.mp4') || urlLower.includes('video')) {
                    fileType = 'video';
                  }
                  
                  mediaUrls.push({
                    path: `${currentPath}[${index}]`,
                    url: item,
                    length: item.length,
                    type: fileType,
                    isShort: item.length <= 200
                  });
                }
              });
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              findUrls(obj[key], currentPath);
            }
          }
        }
        
        findUrls(data);
        
        // 分类统计
        const audioUrls = mediaUrls.filter(u => u.type === 'audio');
        const videoUrls = mediaUrls.filter(u => u.type === 'video');
        const shortAudioUrls = audioUrls.filter(u => u.isShort);
        const shortVideoUrls = videoUrls.filter(u => u.isShort);
        
        return new Response(JSON.stringify({
          success: true,
          stats: {
            totalUrls: mediaUrls.length,
            audioUrls: audioUrls.length,
            videoUrls: videoUrls.length,
            shortAudioUrls: shortAudioUrls.length,
            shortVideoUrls: shortVideoUrls.length
          },
          audioUrls: audioUrls.sort((a, b) => a.length - b.length),
          videoUrls: videoUrls.sort((a, b) => a.length - b.length),
          recommendation: shortAudioUrls.length > 0 ? 
            '建议使用音频URL（更短且云猫同样支持）' : 
            '没有找到短的音频URL'
        }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 主处理流程 - 优先使用音频
      if (url.pathname === '/api/process' || url.pathname === '/api/process/smart') {
        const body = await request.json();
        const douyinUrl = body.douyinUrl;
        
        if (!douyinUrl) {
          return new Response(JSON.stringify({
            error: 'Missing douyinUrl parameter'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用 TikHub
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
        
        const aweme = tikHubData.data?.aweme_detail;
        let selectedUrl = null;
        let urlType = null;
        
        // 策略1：优先查找音频URL（背景音乐）
        if (aweme?.music?.play_url?.url_list) {
          for (const url of aweme.music.play_url.url_list) {
            if (url && url.includes('.mp3') && url.length <= 200) {
              selectedUrl = url;
              urlType = 'music';
              console.log('找到背景音乐URL:', url.length, '字符');
              break;
            }
          }
        }
        
        // 策略2：如果没有短的音频，查找最短的视频URL
        if (!selectedUrl) {
          const videoUrls = [];
          
          // 收集所有视频URL
          if (aweme?.video?.play_addr?.url_list) {
            aweme.video.play_addr.url_list.forEach(url => {
              if (url) videoUrls.push({ url, type: 'play_addr' });
            });
          }
          
          if (aweme?.video?.download_addr?.url_list) {
            aweme.video.download_addr.url_list.forEach(url => {
              if (url) videoUrls.push({ url, type: 'download_addr' });
            });
          }
          
          // 排序找最短的
          videoUrls.sort((a, b) => a.url.length - b.url.length);
          
          if (videoUrls.length > 0) {
            selectedUrl = videoUrls[0].url;
            urlType = videoUrls[0].type;
            console.log('使用最短的视频URL:', videoUrls[0].url.length, '字符');
          }
        }
        
        if (!selectedUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '无法找到任何媒体URL'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 检查长度
        if (selectedUrl.length > 200) {
          return new Response(JSON.stringify({
            success: false,
            error: 'URL太长，超过云猫限制',
            urlType: urlType,
            urlLength: selectedUrl.length,
            limit: 200,
            suggestion: urlType === 'music' ? 
              '连音频URL都太长，这个视频无法处理' : 
              '所有视频URL都太长，且没有找到音频文件'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用云猫
        const notifyUrl = body.notifyUrl || `${url.origin}/api/yunmao/callback`;
        const yunmaoPayload = {
          language: 'chinese',
          fileUrl: selectedUrl,
          notifyUrl: notifyUrl,
          resultType: 'str',
          chat: false
        };
        
        console.log('发送给云猫的参数:', JSON.stringify(yunmaoPayload, null, 2));
        
        const yunmaoResponse = await fetch('https://api.guangfan.tech/v1/get-text', {
          method: 'POST',
          headers: {
            'api-key': env.YUNMAO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(yunmaoPayload)
        });
        
        const yunmaoData = await yunmaoResponse.json();
        const isSuccess = yunmaoData.code === 0;
        
        return new Response(JSON.stringify({
          success: isSuccess,
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID'
          },
          selectedUrl: {
            url: selectedUrl,
            length: selectedUrl.length,
            type: urlType
          },
          taskId: yunmaoData.data,
          yunmaoResponse: yunmaoData,
          message: isSuccess ? 
            `✅ 成功！任务ID: ${yunmaoData.data}` : 
            `❌ 失败: ${yunmaoData.message}`,
          note: urlType === 'music' ? 
            '注意：使用的是背景音乐文件，可能只包含音乐没有人声' : 
            '使用的是视频文件'
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