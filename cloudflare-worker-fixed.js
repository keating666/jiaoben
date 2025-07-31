/**
 * Cloudflare Worker - API 代理服务（修复版）
 * 正确解析 TikHub 返回的视频 URL
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
      
      // 完整流程 - 修复版
      if (url.pathname === '/api/douyin/process') {
        const { douyinUrl } = await request.json();
        console.log('收到请求，抖音链接:', douyinUrl);
        
        // 步骤1: 调用 TikHub API
        const tikHubUrl = `https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(douyinUrl)}`;
        console.log('调用 TikHub:', tikHubUrl);
        
        const tikHubRes = await fetch(tikHubUrl, {
          headers: {
            'Authorization': `Bearer ${env.TIKHUB_API_TOKEN}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const tikHubData = await tikHubRes.json();
        console.log('TikHub 响应:', JSON.stringify(tikHubData, null, 2));
        
        if (tikHubData.code !== 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'TikHub 解析失败',
            details: tikHubData
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 提取视频URL - 更详细的路径
        let videoUrl = null;
        const data = tikHubData.data;
        
        // 尝试多种可能的路径
        if (data) {
          // 方式1: data.play
          if (data.play && typeof data.play === 'string') {
            videoUrl = data.play;
          }
          // 方式2: data.video.play_addr.url_list
          else if (data.video?.play_addr?.url_list?.[0]) {
            videoUrl = data.video.play_addr.url_list[0];
          }
          // 方式3: data.video.download_addr.url_list
          else if (data.video?.download_addr?.url_list?.[0]) {
            videoUrl = data.video.download_addr.url_list[0];
          }
          // 方式4: data.aweme_detail.video.play_addr
          else if (data.aweme_detail?.video?.play_addr?.url_list?.[0]) {
            videoUrl = data.aweme_detail.video.play_addr.url_list[0];
          }
          // 方式5: 直接查找任何 url_list
          else {
            const findUrlList = (obj) => {
              for (const key in obj) {
                if (key === 'url_list' && Array.isArray(obj[key]) && obj[key].length > 0) {
                  return obj[key][0];
                }
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                  const found = findUrlList(obj[key]);
                  if (found) return found;
                }
              }
              return null;
            };
            videoUrl = findUrlList(data);
          }
        }
        
        // 步骤2: 如果获取到视频URL，调用云猫
        if (videoUrl && videoUrl.startsWith('http')) {
          console.log('找到视频URL:', videoUrl);
          
          const yunmaoRes = await fetch('https://api.guangfan.tech/v1/get-text', {
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
          
          const yunmaoData = await yunmaoRes.json();
          console.log('云猫响应:', yunmaoData);
          
          return new Response(JSON.stringify({
            success: yunmaoData.code === 0,
            videoUrl: videoUrl,
            taskId: yunmaoData.data,
            yunmaoResponse: yunmaoData,
            region: request.cf?.colo || 'unknown'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          // 没找到视频URL，返回调试信息
          return new Response(JSON.stringify({
            success: false,
            error: '未能从 TikHub 响应中提取视频 URL',
            debugInfo: {
              dataKeys: data ? Object.keys(data) : [],
              videoKeys: data?.video ? Object.keys(data.video) : [],
              rawResponse: tikHubData
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 调试端点 - 查看 TikHub 原始响应
      if (url.pathname === '/api/tikhub/debug') {
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
        
        // 分析响应结构
        const analysis = {
          success: data.code === 0,
          dataStructure: data.data ? Object.keys(data.data) : [],
          videoStructure: data.data?.video ? Object.keys(data.data.video) : [],
          possibleUrls: []
        };
        
        // 查找所有可能的 URL
        const findUrls = (obj, path = '') => {
          for (const key in obj) {
            const currentPath = path ? `${path}.${key}` : key;
            if (typeof obj[key] === 'string' && obj[key].includes('http')) {
              analysis.possibleUrls.push({
                path: currentPath,
                url: obj[key]
              });
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
              findUrls(obj[key], currentPath);
            }
          }
        };
        
        if (data.data) {
          findUrls(data.data);
        }
        
        return new Response(JSON.stringify({
          ...analysis,
          rawResponse: data
        }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error('Worker 错误:', error);
      return new Response(JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};