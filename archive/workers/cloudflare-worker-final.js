/**
 * Cloudflare Worker 最终版 - 修复云猫必填参数
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
        
        // 这里可以存储结果或转发给其他服务
        return new Response(JSON.stringify({
          success: true,
          message: '回调接收成功',
          data: callbackData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
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
        
        // 步骤2: 调用云猫 - 包含所有必填参数
        const notifyUrl = body.notifyUrl || `${url.origin}/api/yunmao/callback`;
        
        const yunmaoPayload = {
          language: 'chinese',
          fileUrl: videoUrl,
          notifyUrl: notifyUrl,  // 必填参数！
          resultType: 'str',     // 返回文本字符串
          chat: false            // 非对话模式
        };
        
        console.log('云猫请求参数:', JSON.stringify(yunmaoPayload));
        
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
          videoUrl: videoUrl,
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
          note: '处理完成后，结果将发送到回调地址'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 查询任务状态端点（可选功能）
      if (url.pathname === '/api/task/status') {
        const { taskId } = await request.json();
        
        if (!taskId) {
          return new Response(JSON.stringify({
            error: 'Missing taskId parameter'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 云猫 API 可能没有查询接口，这里返回提示
        return new Response(JSON.stringify({
          message: '请等待回调通知，或检查你提供的 notifyUrl',
          taskId: taskId,
          note: '云猫会在处理完成后自动调用回调地址'
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
          return new Response(JSON.stringify({
            success: true,
            message: 'TikHub API 调用成功',
            videoInfo: {
              title: aweme?.desc || '无标题',
              author: aweme?.author?.nickname || '未知作者',
              videoId: aweme?.aweme_id || '未知ID',
              playUrl: aweme?.video?.play_addr?.url_list?.[0] || null
            }
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