/**
 * Cloudflare Worker - 使用短链接解决URL长度限制
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
      
      // 创建短链接的辅助函数
      async function createShortUrl(longUrl) {
        // 方案1: 使用免费的短链接服务
        try {
          const response = await fetch('https://api.short.io/links/public', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              originalURL: longUrl,
              domain: 'short.io',
              allowDuplicates: false
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            return data.shortURL;
          }
        } catch (e) {
          console.log('Short.io 失败，尝试其他方案');
        }
        
        // 方案2: 使用 TinyURL
        try {
          const tinyUrlApi = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`;
          const response = await fetch(tinyUrlApi);
          if (response.ok) {
            const shortUrl = await response.text();
            return shortUrl.trim();
          }
        } catch (e) {
          console.log('TinyURL 失败');
        }
        
        // 方案3: 使用 is.gd
        try {
          const isgdApi = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`;
          const response = await fetch(isgdApi);
          if (response.ok) {
            const shortUrl = await response.text();
            return shortUrl.trim();
          }
        } catch (e) {
          console.log('is.gd 失败');
        }
        
        // 如果都失败了，返回null
        return null;
      }
      
      // 完整处理流程
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
        
        console.log('原始视频URL长度:', videoUrl.length);
        
        // 检查URL长度
        let finalVideoUrl = videoUrl;
        if (videoUrl.length > 190) {
          console.log('URL太长，需要创建短链接');
          
          // 尝试创建短链接
          const shortUrl = await createShortUrl(videoUrl);
          
          if (shortUrl) {
            console.log('短链接创建成功:', shortUrl);
            finalVideoUrl = shortUrl;
          } else {
            // 方案4: 使用抖音自己的短链接
            // 尝试使用 download_addr 中的短链接格式
            if (aweme?.video?.download_addr?.url_list?.length > 2) {
              const douyinShortUrl = aweme.video.download_addr.url_list[2];
              if (douyinShortUrl && douyinShortUrl.startsWith('https://www.douyin.com/aweme/v1/play/')) {
                console.log('使用抖音短链接:', douyinShortUrl);
                finalVideoUrl = douyinShortUrl;
              }
            }
            
            // 如果还是太长，返回错误
            if (finalVideoUrl.length > 190) {
              return new Response(JSON.stringify({
                success: false,
                step: '短链接创建',
                error: 'URL太长且无法创建短链接',
                originalLength: videoUrl.length,
                suggestion: '请尝试其他视频或联系技术支持'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
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
        console.log('最终URL长度:', finalVideoUrl.length);
        
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
          originalVideoUrl: videoUrl,
          finalVideoUrl: finalVideoUrl,
          urlLength: {
            original: videoUrl.length,
            final: finalVideoUrl.length,
            reduced: videoUrl.length - finalVideoUrl.length
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
          notifyUrl: notifyUrl
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // TikHub 测试端点
      if (url.pathname === '/api/tikhub/test') {
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
          
          // 分析所有可用的URL
          const urls = [];
          
          if (aweme?.video?.play_addr?.url_list) {
            aweme.video.play_addr.url_list.forEach((url, index) => {
              urls.push({
                type: 'play_addr',
                index: index,
                length: url.length,
                url: url
              });
            });
          }
          
          if (aweme?.video?.download_addr?.url_list) {
            aweme.video.download_addr.url_list.forEach((url, index) => {
              urls.push({
                type: 'download_addr',
                index: index,
                length: url.length,
                url: url
              });
            });
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: 'TikHub API 调用成功',
            videoInfo: {
              title: aweme?.desc || '无标题',
              author: aweme?.author?.nickname || '未知作者',
              videoId: aweme?.aweme_id || '未知ID'
            },
            availableUrls: urls.sort((a, b) => a.length - b.length),
            shortestUrl: urls.sort((a, b) => a.length - b.length)[0],
            urlLengthLimit: 200
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