/**
 * Cloudflare Worker - 修复URL截断问题
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
      
      // 主处理流程
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
        
        // 查找抖音官方短链接 - 修复：获取完整的URL
        const aweme = tikHubData.data?.aweme_detail;
        let selectedUrl = null;
        
        // 优先查找抖音官方短链接（通常在 download_addr 的最后一个）
        if (aweme?.video?.download_addr?.url_list) {
          for (const url of aweme.video.download_addr.url_list) {
            if (url && url.startsWith('https://www.douyin.com/aweme/v1/play/')) {
              // 这是完整的抖音官方短链接，不要截断！
              selectedUrl = url;
              console.log('找到抖音官方短链接:', url);
              console.log('长度:', url.length);
              break;
            }
          }
        }
        
        // 如果没找到官方短链接，使用最短的 play_addr
        if (!selectedUrl && aweme?.video?.play_addr?.url_list) {
          let shortest = null;
          let shortestLength = Infinity;
          
          for (const url of aweme.video.play_addr.url_list) {
            if (url && url.length < shortestLength) {
              shortest = url;
              shortestLength = url.length;
            }
          }
          
          if (shortest) {
            selectedUrl = shortest;
            console.log('使用最短的play_addr:', shortest.length, '字符');
          }
        }
        
        if (!selectedUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '无法找到视频URL',
            availableUrls: {
              play_addr: aweme?.video?.play_addr?.url_list || [],
              download_addr: aweme?.video?.download_addr?.url_list || []
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 如果URL太长，返回错误和建议
        if (selectedUrl.length > 200) {
          return new Response(JSON.stringify({
            success: false,
            error: 'URL太长，超过云猫限制',
            urlLength: selectedUrl.length,
            limit: 200,
            suggestion: '这个视频的所有URL都太长，云猫API无法处理。建议：1) 尝试其他视频 2) 联系云猫增加限制 3) 使用其他转文字服务'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用云猫
        const notifyUrl = body.notifyUrl || `${url.origin}/api/yunmao/callback`;
        const yunmaoPayload = {
          language: 'chinese',
          fileUrl: selectedUrl,  // 使用完整的URL！
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
            type: selectedUrl.includes('download') ? 'download_addr' : 'play_addr'
          },
          taskId: yunmaoData.data,
          yunmaoResponse: yunmaoData,
          message: isSuccess ? 
            `✅ 成功！任务ID: ${yunmaoData.data}` : 
            `❌ 失败: ${yunmaoData.message}`
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