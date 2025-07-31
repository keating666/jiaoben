/**
 * Cloudflare Worker - 支持云猫回调的版本
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
      
      // 云猫回调接收端点
      if (url.pathname === '/api/yunmao/callback') {
        const callbackData = await request.json();
        console.log('收到云猫回调:', JSON.stringify(callbackData));
        
        // 存储结果到 KV（如果配置了）
        if (env.YUNMAO_RESULTS) {
          await env.YUNMAO_RESULTS.put(
            `task:${callbackData.taskId}`, 
            JSON.stringify({
              ...callbackData,
              receivedAt: new Date().toISOString()
            }),
            { expirationTtl: 3600 } // 1小时过期
          );
        }
        
        // 返回成功响应给云猫
        return new Response(JSON.stringify({
          success: true,
          message: '回调已接收'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // 查询任务结果（从KV存储查询）
      if (url.pathname === '/api/task/query') {
        const body = await request.json();
        const taskId = body.taskId;
        
        if (!taskId) {
          return new Response(JSON.stringify({
            error: 'Missing taskId parameter'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 从KV存储查询结果
        if (env.YUNMAO_RESULTS) {
          const result = await env.YUNMAO_RESULTS.get(`task:${taskId}`);
          
          if (result) {
            const data = JSON.parse(result);
            return new Response(JSON.stringify({
              success: true,
              status: 'completed',
              result: data.data,
              taskId: data.taskId,
              receivedAt: data.receivedAt
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        // 如果没有KV存储或没找到结果
        return new Response(JSON.stringify({
          success: true,
          status: 'processing',
          message: '任务正在处理中，云猫将在完成后推送结果',
          note: '云猫API是推送模式，不支持主动查询。请等待回调通知。'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 获取所有已完成的任务（调试用）
      if (url.pathname === '/api/tasks/list') {
        if (env.YUNMAO_RESULTS) {
          const list = await env.YUNMAO_RESULTS.list({ prefix: 'task:' });
          const tasks = [];
          
          for (const key of list.keys) {
            const data = await env.YUNMAO_RESULTS.get(key.name);
            if (data) {
              tasks.push(JSON.parse(data));
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            tasks: tasks
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: 'KV存储未配置'
        }), {
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
              console.log('找到音频URL（包含人声）:', url.length, '字符');
              break;
            }
          }
        }
        
        // 策略2：如果没有短的音频，查找最短的视频URL
        if (!selectedUrl) {
          const videoUrls = [];
          
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
          
          videoUrls.sort((a, b) => a.url.length - b.url.length);
          
          if (videoUrls.length > 0 && videoUrls[0].url.length <= 200) {
            selectedUrl = videoUrls[0].url;
            urlType = videoUrls[0].type;
          }
        }
        
        if (!selectedUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '没有找到长度合适的媒体文件（需要≤200字符）'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 调用云猫 - 使用正确的回调URL
        const notifyUrl = `${url.origin}/api/yunmao/callback`;
        const yunmaoPayload = {
          language: 'chinese',
          fileUrl: selectedUrl,
          notifyUrl: notifyUrl,
          resultType: 'str', // 使用字符串格式，更容易处理
          chat: false
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
        const isSuccess = yunmaoData.code === 0;
        
        return new Response(JSON.stringify({
          success: isSuccess,
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID',
            musicTitle: aweme?.music?.title || '未知音乐'
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
            '使用音频文件（包含人声+背景音乐）' : 
            '使用视频文件',
          callbackUrl: notifyUrl,
          hint: '云猫将在处理完成后推送结果到回调地址'
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