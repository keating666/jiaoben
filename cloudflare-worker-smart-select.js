/**
 * Cloudflare Worker - 智能选择最短的直接视频链接
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
      
      // 云猫回调接收端点
      if (url.pathname === '/api/yunmao/callback') {
        const callbackData = await request.json();
        console.log('收到云猫回调:', JSON.stringify(callbackData));
        
        return new Response(JSON.stringify({
          success: true,
          message: '回调接收成功',
          data: callbackData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 完整处理流程 - 智能选择最短URL
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
        
        if (tikHubData.code !== 200) {
          return new Response(JSON.stringify({
            success: false,
            step: 'TikHub',
            error: tikHubData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 收集所有可用的视频URL
        const videoUrls = [];
        const aweme = tikHubData.data?.aweme_detail;
        
        // 收集 play_addr 的所有URL
        if (aweme?.video?.play_addr?.url_list) {
          aweme.video.play_addr.url_list.forEach((url, index) => {
            if (url && url.startsWith('http')) {
              videoUrls.push({
                type: 'play_addr',
                index: index,
                url: url,
                length: url.length,
                priority: 1 // 优先级最高
              });
            }
          });
        }
        
        // 收集 download_addr 的所有URL
        if (aweme?.video?.download_addr?.url_list) {
          aweme.video.download_addr.url_list.forEach((url, index) => {
            if (url && url.startsWith('http')) {
              videoUrls.push({
                type: 'download_addr',
                index: index,
                url: url,
                length: url.length,
                priority: 2 // 次优先级
              });
            }
          });
        }
        
        // 收集 play_addr_h264 的URL
        if (aweme?.video?.play_addr_h264?.url_list) {
          aweme.video.play_addr_h264.url_list.forEach((url, index) => {
            if (url && url.startsWith('http')) {
              videoUrls.push({
                type: 'play_addr_h264',
                index: index,
                url: url,
                length: url.length,
                priority: 3
              });
            }
          });
        }
        
        // 收集 play_addr_265 的URL
        if (aweme?.video?.play_addr_265?.url_list) {
          aweme.video.play_addr_265.url_list.forEach((url, index) => {
            if (url && url.startsWith('http')) {
              videoUrls.push({
                type: 'play_addr_265',
                index: index,
                url: url,
                length: url.length,
                priority: 4
              });
            }
          });
        }
        
        if (videoUrls.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            step: 'URL提取',
            error: '无法从 TikHub 响应中提取任何视频 URL'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 智能选择最佳URL
        // 1. 首先筛选出长度小于等于200的URL
        let candidateUrls = videoUrls.filter(u => u.length <= 200);
        
        // 2. 如果没有短URL，选择最短的
        if (candidateUrls.length === 0) {
          console.log('没有短于200字符的URL，选择最短的URL');
          candidateUrls = videoUrls;
        }
        
        // 3. 按优先级和长度排序
        candidateUrls.sort((a, b) => {
          // 先按优先级排序
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          // 再按长度排序
          return a.length - b.length;
        });
        
        // 选择最佳URL
        const selectedUrl = candidateUrls[0];
        console.log(`选择的URL: ${selectedUrl.type}[${selectedUrl.index}], 长度: ${selectedUrl.length}`);
        
        // 如果选中的URL仍然太长，尝试处理
        let finalVideoUrl = selectedUrl.url;
        
        if (selectedUrl.length > 200) {
          // 尝试清理URL参数
          try {
            const urlObj = new URL(finalVideoUrl);
            // 保留必要参数，移除追踪参数
            const essentialParams = ['video_id', 'line', 'file_id', 'sign', 'source'];
            const params = new URLSearchParams();
            
            for (const [key, value] of urlObj.searchParams) {
              if (essentialParams.includes(key)) {
                params.append(key, value);
              }
            }
            
            urlObj.search = params.toString();
            const cleanedUrl = urlObj.toString();
            
            if (cleanedUrl.length <= 200) {
              console.log('通过清理参数缩短了URL');
              finalVideoUrl = cleanedUrl;
            }
          } catch (e) {
            console.log('URL清理失败:', e);
          }
          
          // 如果还是太长，返回错误并提供所有选项
          if (finalVideoUrl.length > 200) {
            return new Response(JSON.stringify({
              success: false,
              step: 'URL长度检查',
              error: '所有视频URL都超过200字符限制',
              availableUrls: videoUrls.map(u => ({
                type: u.type,
                length: u.length,
                url: u.url
              })),
              shortestUrl: selectedUrl,
              suggestion: '此视频的URL太长，云猫API无法处理。请尝试其他视频或联系技术支持。'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        // 步骤2: 调用云猫
        const notifyUrl = body.notifyUrl || `${url.origin}/api/yunmao/callback`;
        
        const yunmaoPayload = {
          language: 'chinese',
          fileUrl: finalVideoUrl,
          notifyUrl: notifyUrl,
          resultType: 'str',
          chat: false
        };
        
        console.log('云猫请求参数:', JSON.stringify(yunmaoPayload));
        console.log('URL长度:', finalVideoUrl.length);
        
        const yunmaoResponse = await fetch('https://api.guangfan.tech/v1/get-text', {
          method: 'POST',
          headers: {
            'api-key': env.YUNMAO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(yunmaoPayload)
        });
        
        const yunmaoData = await yunmaoResponse.json();
        
        // 判断成功
        const isSuccess = yunmaoData.code === 0;
        
        return new Response(JSON.stringify({
          success: isSuccess,
          selectedUrl: {
            type: selectedUrl.type,
            index: selectedUrl.index,
            length: selectedUrl.length,
            finalLength: finalVideoUrl.length
          },
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID'
          },
          taskId: yunmaoData.data,
          yunmaoResponse: yunmaoData,
          message: isSuccess ? 
            `视频已提交转文字处理，任务ID: ${yunmaoData.data}` : 
            `云猫处理失败: ${yunmaoData.message || '未知错误'}`,
          notifyUrl: notifyUrl,
          urlAnalysis: {
            totalUrls: videoUrls.length,
            shortUrls: videoUrls.filter(u => u.length <= 200).length,
            selectedType: selectedUrl.type,
            selectedLength: finalVideoUrl.length
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 分析URL端点
      if (url.pathname === '/api/analyze/urls') {
        const body = await request.json().catch(() => ({}));
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
          const urls = [];
          
          // 收集所有URL
          const collectUrls = (obj, path = '') => {
            for (const key in obj) {
              if (typeof obj[key] === 'string' && obj[key].includes('.mp4')) {
                urls.push({
                  path: path + '.' + key,
                  url: obj[key],
                  length: obj[key].length,
                  isVideo: true
                });
              } else if (Array.isArray(obj[key])) {
                obj[key].forEach((item, index) => {
                  if (typeof item === 'string' && item.includes('http')) {
                    urls.push({
                      path: `${path}.${key}[${index}]`,
                      url: item,
                      length: item.length,
                      isVideo: item.includes('.mp4') || item.includes('video')
                    });
                  }
                });
              } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                collectUrls(obj[key], path + '.' + key);
              }
            }
          };
          
          if (aweme?.video) {
            collectUrls(aweme.video, 'video');
          }
          
          // 按长度排序
          const videoUrls = urls.filter(u => u.isVideo).sort((a, b) => a.length - b.length);
          
          return new Response(JSON.stringify({
            success: true,
            videoInfo: {
              title: aweme?.desc || '无标题',
              author: aweme?.author?.nickname || '未知作者'
            },
            urlStats: {
              total: videoUrls.length,
              under200: videoUrls.filter(u => u.length <= 200).length,
              shortest: videoUrls[0],
              longest: videoUrls[videoUrls.length - 1]
            },
            videoUrls: videoUrls,
            recommendation: videoUrls.filter(u => u.length <= 200).length > 0 ?
              '有可用的短URL，可以直接使用' :
              '所有URL都太长，需要其他解决方案'
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