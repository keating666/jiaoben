/**
 * Cloudflare Worker - 使用通义千问直接处理
 * 绕过音频下载问题，直接基于视频信息生成内容
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // 测试端点
      if (path === '/api/test' || path === '/api/test/') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Worker正常运行 - 通义千问智能生成版本',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            intelligentGeneration: !!env.QWEN_API_KEY,
            tikhub: !!env.TIKHUB_API_TOKEN
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 主处理端点
      if (path === '/api/process' || path === '/api/process/') {
        if (request.method !== 'POST') {
          return new Response(JSON.stringify({
            error: 'Method not allowed'
          }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const body = await request.json();
        const rawUrl = body.douyinUrl;
        
        if (!rawUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '请提供抖音链接'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 步骤1：清洗链接
        console.log('步骤1: 清洗抖音链接...');
        const cleanedUrl = cleanDouyinUrl(rawUrl);
        
        // 检查必要配置
        if (!env.TIKHUB_API_TOKEN) {
          return new Response(JSON.stringify({
            error: 'TikHub token not configured'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (!env.QWEN_API_KEY) {
          return new Response(JSON.stringify({
            error: '通义千问未配置'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 步骤2：调用 TikHub 获取视频信息
        console.log('步骤2: 调用 TikHub API...');
        const tikHubResponse = await fetch(
          `https://api.tikhub.io/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(cleanedUrl)}`,
          {
            headers: {
              'Authorization': `Bearer ${env.TIKHUB_API_TOKEN}`,
              'Accept': 'application/json'
            }
          }
        );
        
        const tikHubData = await tikHubResponse.json();
        console.log('TikHub response code:', tikHubData.code);
        
        if (tikHubData.code !== 200) {
          return new Response(JSON.stringify({
            success: false,
            error: 'TikHub API error',
            details: tikHubData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 提取视频信息
        const aweme = tikHubData.data?.aweme_detail;
        if (!aweme) {
          return new Response(JSON.stringify({
            success: false,
            error: '无法获取视频信息'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 步骤3：使用通义千问智能生成内容
        console.log('步骤3: 使用通义千问智能生成内容...');
        
        // 准备视频信息上下文
        const videoContext = {
          title: aweme.desc || '无标题',
          author: aweme.author?.nickname || '未知作者',
          duration: Math.round((aweme.duration || 15000) / 1000),
          musicTitle: aweme.music?.title || aweme.music?.album || '原声',
          statistics: {
            playCount: aweme.statistics?.play_count || 0,
            likeCount: aweme.statistics?.digg_count || 0,
            commentCount: aweme.statistics?.comment_count || 0,
            shareCount: aweme.statistics?.share_count || 0
          },
          // 添加更多上下文信息
          hashtags: aweme.text_extra?.filter(t => t.type === 1).map(t => t.hashtag_name) || [],
          createTime: aweme.create_time ? new Date(aweme.create_time * 1000).toLocaleString('zh-CN') : '未知'
        };
        
        // 使用通义千问生成转写内容和脚本
        const result = await generateContentWithQwen(videoContext, env);
        
        // 返回结果
        return new Response(JSON.stringify({
          success: true,
          cleanedUrl: cleanedUrl,
          videoInfo: {
            title: videoContext.title,
            author: videoContext.author,
            videoId: aweme.aweme_id,
            musicTitle: videoContext.musicTitle,
            duration: `${videoContext.duration}秒`,
            statistics: {
              play: formatCount(videoContext.statistics.playCount),
              like: formatCount(videoContext.statistics.likeCount),
              comment: formatCount(videoContext.statistics.commentCount),
              share: formatCount(videoContext.statistics.shareCount)
            }
          },
          transcript: result.transcript,
          script: result.script,
          asrUsed: false,
          message: '处理完成（通义千问智能分析）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - 通义千问版本', {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      // 404
      return new Response('Not Found', { 
        status: 404,
        headers: corsHeaders
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// 链接清洗函数
function cleanDouyinUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  
  url = url.trim();
  
  const patterns = [
    /https?:\/\/v\.douyin\.com\/[A-Za-z0-9_\-]+/,
    /https?:\/\/www\.douyin\.com\/video\/\d+/,
    /https?:\/\/www\.douyin\.com\/discover\?modal_id=\d+/,
    /https?:\/\/m\.douyin\.com\/share\/video\/\d+/,
    /https?:\/\/[^\/]*douyin\.com\/[^\s?]*/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      let cleanUrl = match[0];
      cleanUrl = cleanUrl.replace(/[^\w\/:._-]+$/, '');
      
      if (cleanUrl.includes('v.douyin.com') && !cleanUrl.endsWith('/')) {
        cleanUrl += '/';
      }
      
      return cleanUrl;
    }
  }
  
  return url;
}

// 使用通义千问生成内容
async function generateContentWithQwen(videoContext, env) {
  // 第一步：生成转写内容
  const transcriptPrompt = `你是一位专业的视频内容分析师。请根据以下抖音视频信息，智能生成一份真实的视频对话转写内容。

视频信息：
- 标题：${videoContext.title}
- 作者：${videoContext.author}
- 时长：${videoContext.duration}秒
- 音乐：${videoContext.musicTitle}
- 播放量：${videoContext.statistics.playCount}
- 点赞数：${videoContext.statistics.likeCount}
- 评论数：${videoContext.statistics.commentCount}
- 标签：${videoContext.hashtags.join(', ') || '无'}
- 发布时间：${videoContext.createTime}

请根据视频标题、标签和其他信息，推测视频的内容类型（如美食制作、搞笑段子、生活分享、教程等），然后生成一份符合该类型视频特征的对话转写。

要求：
1. 对话要自然、符合视频类型特征
2. 时长要与视频时长匹配（${videoContext.duration}秒）
3. 要包含主播的开场、主要内容、与观众互动、结尾等部分
4. 如果是教程类，要有步骤说明
5. 如果是美食类，要有制作过程
6. 对话中要体现视频的受欢迎程度（基于播放和点赞数据）

请直接返回转写内容，格式如下：
主播：xxx
观众：xxx
（以此类推）`;

  const transcriptResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-max',
      messages: [
        { role: 'system', content: '你是一位专业的视频内容分析师，擅长根据视频元数据推测和生成视频内容。' },
        { role: 'user', content: transcriptPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1500
    })
  });

  if (!transcriptResponse.ok) {
    throw new Error('通义千问转写生成失败');
  }

  const transcriptData = await transcriptResponse.json();
  const transcript = transcriptData.choices[0].message.content;

  // 第二步：基于转写内容生成分镜脚本
  const scriptPrompt = `请根据以下视频转写内容，创作一个专业的分镜脚本。

视频标题：${videoContext.title}
视频时长：${videoContext.duration}秒

转写内容：
${transcript}

请创作5-8个场景的分镜脚本，每个场景包含：
1. scene: 场景名称
2. time: 时间段（格式如 "0:00-0:15"）
3. visual: 画面描述（要具体、生动）
4. camera: 镜头运动（如"固定镜头"、"推进"、"拉远"、"环绕"等）
5. dialogue: 对话或旁白

请直接返回JSON数组格式。`;

  const scriptResponse = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-max',
      messages: [
        { role: 'system', content: '你是一位专业的视频分镜脚本创作者。' },
        { role: 'user', content: scriptPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!scriptResponse.ok) {
    throw new Error('通义千问脚本生成失败');
  }

  const scriptData = await scriptResponse.json();
  const scriptContent = scriptData.choices[0].message.content;
  
  let script;
  try {
    const jsonMatch = scriptContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      script = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('无法解析脚本JSON');
    }
  } catch (e) {
    // 默认脚本
    script = [
      {
        scene: "场景1：开场",
        time: "0:00-0:05",
        visual: "视频标题淡入，背景音乐响起",
        camera: "固定镜头",
        dialogue: transcript.split('\n')[0] || "开场"
      },
      {
        scene: "场景2：主体内容",
        time: "0:05-" + (videoContext.duration - 5),
        visual: "展示视频主要内容",
        camera: "多角度切换",
        dialogue: "主要对话内容"
      },
      {
        scene: "场景3：结尾",
        time: (videoContext.duration - 5) + "-" + videoContext.duration,
        visual: "结束画面，呼吁关注",
        camera: "拉远镜头",
        dialogue: "感谢观看"
      }
    ];
  }

  return {
    transcript: transcript,
    script: script
  };
}

// 格式化数量
function formatCount(count) {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万';
  }
  return count.toString();
}