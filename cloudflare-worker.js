/**
 * Cloudflare Worker - API 代理服务
 * 部署后立即获得香港/新加坡节点访问
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
    
    // 路由处理
    try {
      // TikHub 代理
      if (url.pathname === '/api/tikhub/parse') {
        return handleTikHub(request, corsHeaders, env);
      }
      
      // 云猫代理
      if (url.pathname === '/api/yunmao/submit') {
        return handleYunmao(request, corsHeaders, env);
      }
      
      // 完整流程
      if (url.pathname === '/api/douyin/process') {
        return handleComplete(request, corsHeaders, env);
      }
      
      // 测试端点
      if (url.pathname === '/api/test') {
        return new Response(JSON.stringify({
          success: true,
          region: request.cf?.colo || 'unknown',
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// TikHub 处理
async function handleTikHub(request, corsHeaders, env) {
  const { douyinUrl } = await request.json();
  
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
  
  // 提取视频 URL
  let videoUrl = null;
  if (data.code === 0 && data.data) {
    const video = data.data.video || data.data;
    videoUrl = video.play || video.download_addr || video.play_addr || 
               (video.play_addr?.url_list?.[0]) || 
               (video.download_addr?.url_list?.[0]);
  }
  
  return new Response(JSON.stringify({
    success: !!videoUrl,
    videoUrl: videoUrl || douyinUrl,
    raw: data
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 云猫处理
async function handleYunmao(request, corsHeaders, env) {
  const { videoUrl } = await request.json();
  
  const response = await fetch('https://api.guangfan.tech/v1/get-text', {
    method: 'POST',
    headers: {
      'api-key': env.YUNMAO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      language: 'chinese',
      fileUrl: videoUrl,
      notifyUrl: `${request.url.origin}/api/yunmao/callback`,
      resultType: 'str',
      chat: false
    })
  });
  
  const data = await response.json();
  
  return new Response(JSON.stringify({
    success: data.code === 0,
    taskId: data.data,
    raw: data
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// 完整流程
async function handleComplete(request, corsHeaders, env) {
  const { douyinUrl } = await request.json();
  
  // 步骤1: TikHub 解析
  const tikHubResult = await handleTikHub(
    new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ douyinUrl })
    }),
    {},
    env
  );
  
  const tikHubData = await tikHubResult.json();
  if (!tikHubData.success) {
    return new Response(JSON.stringify({
      success: false,
      error: 'TikHub 解析失败',
      details: tikHubData
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  // 步骤2: 云猫转文字
  const yunmaoResult = await handleYunmao(
    new Request(request.url, {
      method: 'POST',
      body: JSON.stringify({ videoUrl: tikHubData.videoUrl })
    }),
    {},
    env
  );
  
  const yunmaoData = await yunmaoResult.json();
  
  return new Response(JSON.stringify({
    success: yunmaoData.success,
    videoUrl: tikHubData.videoUrl,
    taskId: yunmaoData.taskId,
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}