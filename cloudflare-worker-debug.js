/**
 * Cloudflare Worker - 调试版本，添加详细日志
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
      
      // 云猫参数测试端点
      if (url.pathname === '/api/yunmao/test-params') {
        // 测试最简单的参数
        const testUrl = 'https://example.com/test.mp4';
        const testPayload = {
          language: 'chinese',
          fileUrl: testUrl,
          notifyUrl: 'https://jiaoben-api.keating8500.workers.dev/api/yunmao/callback',
          resultType: 'str',
          chat: false
        };
        
        console.log('测试云猫参数:', JSON.stringify(testPayload));
        
        const yunmaoResponse = await fetch('https://api.guangfan.tech/v1/get-text', {
          method: 'POST',
          headers: {
            'api-key': env.YUNMAO_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPayload)
        });
        
        const responseText = await yunmaoResponse.text();
        let yunmaoData;
        
        try {
          yunmaoData = JSON.parse(responseText);
        } catch (e) {
          return new Response(JSON.stringify({
            error: '云猫返回的不是JSON',
            responseText: responseText,
            status: yunmaoResponse.status
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          test: '简单URL测试',
          testUrl: testUrl,
          testUrlLength: testUrl.length,
          payloadSent: testPayload,
          yunmaoResponse: yunmaoData,
          apiKeyPresent: !!env.YUNMAO_API_KEY,
          apiKeyLength: env.YUNMAO_API_KEY ? env.YUNMAO_API_KEY.length : 0
        }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 主处理流程 - 增加调试信息
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
        
        // 获取最短的URL
        const aweme = tikHubData.data?.aweme_detail;
        let shortestUrl = null;
        let shortestLength = Infinity;
        
        // 检查 play_addr
        if (aweme?.video?.play_addr?.url_list) {
          for (const url of aweme.video.play_addr.url_list) {
            if (url && url.length < shortestLength) {
              shortestUrl = url;
              shortestLength = url.length;
            }
          }
        }
        
        // 检查其他可能的短URL - 特别是抖音官方短链接
        if (aweme?.video?.download_addr?.url_list) {
          for (const url of aweme.video.download_addr.url_list) {
            if (url && url.startsWith('https://www.douyin.com/aweme/v1/play/')) {
              // 这是抖音官方短链接格式
              if (url.length < shortestLength) {
                shortestUrl = url;
                shortestLength = url.length;
              }
            }
          }
        }
        
        if (!shortestUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '无法找到视频URL'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 如果URL仍然太长，尝试使用抖音官方短链接
        let finalUrl = shortestUrl;
        if (shortestLength > 200) {
          // 查找抖音官方短链接
          const officialShortUrl = aweme?.video?.download_addr?.url_list?.find(
            url => url && url.startsWith('https://www.douyin.com/aweme/v1/play/')
          );
          
          if (officialShortUrl && officialShortUrl.length <= 200) {
            finalUrl = officialShortUrl;
            console.log('使用抖音官方短链接');
          } else {
            // 尝试清理URL参数
            try {
              const urlObj = new URL(shortestUrl);
              // 只保留最基本的参数
              const cleanUrl = urlObj.origin + urlObj.pathname;
              if (cleanUrl.length <= 200) {
                finalUrl = cleanUrl;
                console.log('使用清理后的URL');
              }
            } catch (e) {
              console.log('URL清理失败');
            }
          }
        }
        
        // 准备云猫参数
        const notifyUrl = body.notifyUrl || `${url.origin}/api/yunmao/callback`;
        const yunmaoPayload = {
          language: 'chinese',
          fileUrl: finalUrl,
          notifyUrl: notifyUrl,
          resultType: 'str',
          chat: false
        };
        
        console.log('云猫请求详情:');
        console.log('- URL长度:', finalUrl.length);
        console.log('- 参数:', JSON.stringify(yunmaoPayload, null, 2));
        
        // 调用云猫
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
        let yunmaoData;
        
        try {
          yunmaoData = JSON.parse(yunmaoText);
        } catch (e) {
          return new Response(JSON.stringify({
            success: false,
            error: '云猫返回格式错误',
            yunmaoResponseText: yunmaoText,
            yunmaoStatus: yunmaoResponse.status
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const isSuccess = yunmaoData.code === 0;
        
        return new Response(JSON.stringify({
          success: isSuccess,
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID'
          },
          urlDebug: {
            originalLength: shortestUrl.length,
            finalLength: finalUrl.length,
            finalUrl: finalUrl,
            urlCleaned: finalUrl !== shortestUrl
          },
          yunmaoPayload: yunmaoPayload,
          yunmaoResponse: yunmaoData,
          taskId: yunmaoData.data,
          message: isSuccess ? 
            `任务创建成功，ID: ${yunmaoData.data}` : 
            `失败: ${yunmaoData.message}`,
          debugInfo: {
            apiKeyPresent: !!env.YUNMAO_API_KEY,
            apiKeyLength: env.YUNMAO_API_KEY ? env.YUNMAO_API_KEY.length : 0,
            payloadStringLength: JSON.stringify(yunmaoPayload).length
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error('Worker错误:', error);
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