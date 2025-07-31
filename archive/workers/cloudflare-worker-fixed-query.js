/**
 * Cloudflare Worker - 修复查询功能
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
      
      // 查询任务结果 - 修复版本
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
        
        // 调用云猫查询接口
        const queryUrl = `https://api.guangfan.tech/v1/query-result?taskId=${taskId}`;
        
        console.log('查询URL:', queryUrl);
        
        const queryResponse = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            'api-key': env.YUNMAO_API_KEY,
            'Accept': 'application/json'
          }
        });
        
        console.log('云猫响应状态:', queryResponse.status);
        
        // 获取响应文本
        const responseText = await queryResponse.text();
        console.log('云猫原始响应:', responseText);
        
        // 检查响应状态
        if (!queryResponse.ok) {
          return new Response(JSON.stringify({
            success: false,
            error: `云猫API错误: ${queryResponse.status} ${queryResponse.statusText}`,
            details: responseText,
            queryUrl: queryUrl
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 尝试解析JSON
        let queryData;
        try {
          queryData = JSON.parse(responseText);
        } catch (e) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid JSON response from 云猫',
            responseText: responseText
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 处理响应
        if (queryData.code === 0) {
          // 成功
          return new Response(JSON.stringify({
            success: true,
            status: 'completed',
            result: queryData.data?.result || queryData.data?.text || queryData.data || '无结果',
            rawData: queryData,
            message: '查询成功'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (queryData.code === 1001) {
          // 处理中
          return new Response(JSON.stringify({
            success: true,
            status: 'processing',
            message: '任务正在处理中，请稍后再查询',
            rawData: queryData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // 错误
          return new Response(JSON.stringify({
            success: false,
            error: queryData.message || '查询失败',
            code: queryData.code,
            rawData: queryData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
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
        
        // 调用云猫
        const notifyUrl = body.notifyUrl || `${url.origin}/api/yunmao/callback`;
        const yunmaoPayload = {
          language: 'chinese',
          fileUrl: selectedUrl,
          notifyUrl: notifyUrl,
          resultType: 'str',
          chat: false
        };
        
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
            '使用视频文件'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 调试端点 - 直接测试云猫查询
      if (url.pathname === '/api/debug/yunmao') {
        const { taskId } = await request.json();
        
        // 尝试不同的查询方式
        const attempts = [
          {
            name: '方式1: query-result',
            url: `https://api.guangfan.tech/v1/query-result?taskId=${taskId}`,
            method: 'GET'
          },
          {
            name: '方式2: get-result',
            url: `https://api.guangfan.tech/v1/get-result`,
            method: 'POST',
            body: { taskId }
          },
          {
            name: '方式3: result',
            url: `https://api.guangfan.tech/v1/result/${taskId}`,
            method: 'GET'
          }
        ];
        
        const results = [];
        
        for (const attempt of attempts) {
          try {
            const options = {
              method: attempt.method,
              headers: {
                'api-key': env.YUNMAO_API_KEY,
                'Accept': 'application/json'
              }
            };
            
            if (attempt.body) {
              options.headers['Content-Type'] = 'application/json';
              options.body = JSON.stringify(attempt.body);
            }
            
            const response = await fetch(attempt.url, options);
            const text = await response.text();
            
            results.push({
              name: attempt.name,
              status: response.status,
              statusText: response.statusText,
              response: text
            });
          } catch (error) {
            results.push({
              name: attempt.name,
              error: error.message
            });
          }
        }
        
        return new Response(JSON.stringify({
          taskId,
          attempts: results
        }, null, 2), {
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