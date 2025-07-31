/**
 * Cloudflare Worker v5 - 支持音频直接处理
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
      
      // 云猫音频测试端点
      if (url.pathname === '/api/yunmao/test-audio') {
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
        
        const audioUrl = body.audioUrl;
        if (!audioUrl) {
          return new Response(JSON.stringify({
            error: 'Missing audioUrl parameter'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('测试音频 URL:', audioUrl);
        
        // 调用云猫处理音频
        const yunmaoResponse = await fetch('https://api.guangfan.tech/v1/get-text', {
          method: 'POST',
          headers: {
            'api-key': env.YUNMAO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            language: 'chinese',
            fileUrl: audioUrl,
            resultType: 'str',
            chat: false
          })
        });
        
        const yunmaoData = await yunmaoResponse.json();
        
        return new Response(JSON.stringify({
          success: yunmaoData.code === 0,
          audioUrl: audioUrl,
          audioType: audioUrl.includes('music') ? '背景音乐' : '可能包含人声',
          taskId: yunmaoData.data,
          yunmaoResponse: yunmaoData,
          message: yunmaoData.code === 0 ? 
            '音频已提交处理，使用 taskId 查询结果' : 
            '音频处理失败，可能是纯音乐或格式不支持'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // TikHub 测试端点 - 增强版
      if (url.pathname === '/api/tikhub/test') {
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
        
        const douyinUrl = body.douyinUrl || 'https://v.douyin.com/67CMClLwb1c/';
        
        const apiUrl = `https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(douyinUrl)}`;
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${env.TIKHUB_API_TOKEN}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        });
        
        const data = await response.json();
        
        if (data.code === 200 && data.data) {
          const videoData = data.data;
          const allUrls = [];
          const audioUrls = [];
          
          // 递归查找所有 URL
          function findUrls(obj, path = '') {
            for (const key in obj) {
              if (obj[key] === null || obj[key] === undefined) continue;
              
              const currentPath = path ? `${path}.${key}` : key;
              
              if (typeof obj[key] === 'string' && obj[key].includes('http')) {
                const urlInfo = {
                  path: currentPath,
                  url: obj[key]
                };
                allUrls.push(urlInfo);
                
                // 检查是否是音频文件
                const urlLower = obj[key].toLowerCase();
                if (urlLower.includes('.mp3') || 
                    urlLower.includes('.m4a') || 
                    urlLower.includes('.aac') ||
                    urlLower.includes('audio') ||
                    urlLower.includes('sound')) {
                  audioUrls.push(urlInfo);
                }
              } else if (Array.isArray(obj[key])) {
                obj[key].forEach((item, index) => {
                  if (typeof item === 'string' && item.includes('http')) {
                    const urlInfo = {
                      path: `${currentPath}[${index}]`,
                      url: item
                    };
                    allUrls.push(urlInfo);
                    
                    const urlLower = item.toLowerCase();
                    if (urlLower.includes('.mp3') || 
                        urlLower.includes('.m4a') || 
                        urlLower.includes('.aac')) {
                      audioUrls.push(urlInfo);
                    }
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
          
          // 分析音频类型
          const musicUrls = audioUrls.filter(u => u.path.includes('music'));
          const otherAudioUrls = audioUrls.filter(u => !u.path.includes('music'));
          
          // 获取视频信息
          const aweme = videoData.aweme_detail;
          const videoInfo = {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID',
            playUrl: aweme?.video?.play_addr?.url_list?.[0] || null
          };
          
          return new Response(JSON.stringify({
            success: true,
            message: 'TikHub API 调用成功',
            videoInfo: videoInfo,
            audioAnalysis: {
              totalAudioUrls: audioUrls.length,
              musicUrls: musicUrls.length,
              otherAudioUrls: otherAudioUrls.length,
              recommendation: otherAudioUrls.length > 0 ? 
                '发现非音乐音频文件，可能包含人声' : 
                '未发现独立音频文件，人声可能嵌入在视频中'
            },
            audioUrls: audioUrls,
            allUrls: allUrls
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
      
      // 智能处理流程 - 自动选择最佳音频源
      if (url.pathname === '/api/process/smart') {
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
        
        // 获取 TikHub 数据
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
        
        // 智能选择音频源
        let selectedUrl = null;
        let sourceType = null;
        
        const aweme = tikHubData.data?.aweme_detail;
        
        // 策略1: 查找原声音频（非music路径）
        // 这里需要深度搜索，但为了简化，先使用视频URL
        
        // 策略2: 使用视频URL（云猫会自动提取音频）
        if (aweme?.video?.play_addr?.url_list?.[0]) {
          selectedUrl = aweme.video.play_addr.url_list[0];
          sourceType = 'video';
        }
        
        if (!selectedUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '无法找到合适的音频源'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用云猫处理
        const yunmaoResponse = await fetch('https://api.guangfan.tech/v1/get-text', {
          method: 'POST',
          headers: {
            'api-key': env.YUNMAO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            language: 'chinese',
            fileUrl: selectedUrl,
            resultType: 'str',
            chat: false
          })
        });
        
        const yunmaoData = await yunmaoResponse.json();
        
        return new Response(JSON.stringify({
          success: yunmaoData.code === 0,
          sourceType: sourceType,
          selectedUrl: selectedUrl,
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者'
          },
          taskId: yunmaoData.data,
          yunmaoResponse: yunmaoData,
          message: `使用${sourceType === 'video' ? '视频' : '音频'}文件进行语音识别`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 原有的完整处理流程（保持兼容）
      if (url.pathname === '/api/process') {
        // ... 保持原有代码不变
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
        
        let videoUrl = null;
        const aweme = tikHubData.data?.aweme_detail;
        
        if (aweme?.video?.play_addr?.url_list?.[0]) {
          videoUrl = aweme.video.play_addr.url_list[0];
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