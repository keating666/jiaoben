/**
 * Cloudflare Worker - 简化版讯飞语音识别
 * 暂时使用模拟转写，后续接入讯飞实时API
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
    const path = url.pathname;
    
    try {
      // 测试端点
      if (path === '/api/test' || path === '/api/test/') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Worker正常运行 - 讯飞版本（简化）',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            xunfeiASR: !!(env.XUNFEI_APP_ID && env.XUNFEI_API_SECRET && env.XUNFEI_API_KEY),
            aiGeneration: !!env.QWEN_API_KEY,
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
        console.log('清洗后链接:', cleanedUrl);
        
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
        
        // 查找音频URL
        let audioUrl = null;
        
        // 优先使用音乐URL
        if (aweme.music?.play_url?.url_list?.length > 0) {
          audioUrl = aweme.music.play_url.url_list[0];
        }
        // 其次使用视频URL（包含音频）
        else if (aweme.video?.play_addr?.url_list?.length > 0) {
          audioUrl = aweme.video.play_addr.url_list[0];
        }
        
        console.log('找到音频URL:', audioUrl ? '是' : '否');
        
        // 步骤3：生成转写内容
        console.log('步骤3: 生成转写内容...');
        const transcript = await generateEnhancedTranscript(aweme);
        
        // 步骤4：使用通义千问生成分镜脚本
        console.log('步骤4: 使用通义千问生成脚本...');
        const script = await generateScriptWithQwen({
          title: aweme.desc || '无标题',
          author: aweme.author?.nickname || '未知作者',
          transcript: transcript,
          duration: aweme.duration || 15000,
          statistics: aweme.statistics || {}
        }, env);
        
        // 返回结果
        return new Response(JSON.stringify({
          success: true,
          cleanedUrl: cleanedUrl,
          videoInfo: {
            title: aweme.desc || '无标题',
            author: aweme.author?.nickname || '未知作者',
            videoId: aweme.aweme_id,
            musicTitle: aweme.music?.title || aweme.music?.album || '原声',
            duration: formatDuration(aweme.duration || 0),
            statistics: {
              play: formatCount(aweme.statistics?.play_count || 0),
              like: formatCount(aweme.statistics?.digg_count || 0),
              comment: formatCount(aweme.statistics?.comment_count || 0),
              share: formatCount(aweme.statistics?.share_count || 0)
            }
          },
          audioUrl: audioUrl,
          transcript: transcript,
          script: script,
          asrUsed: false,
          message: '处理完成（智能分析）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - 讯飞版本', {
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

// 生成增强的转写内容
async function generateEnhancedTranscript(aweme) {
  const duration = Math.round((aweme.duration || 15000) / 1000);
  const author = aweme.author?.nickname || '主播';
  const title = aweme.desc || '';
  
  // 基于视频标题和统计数据生成更真实的转写内容
  let transcript = '';
  
  // 开场
  transcript += `${author}：大家好，欢迎来到我的抖音直播间。\n\n`;
  
  // 根据标题内容生成对话
  if (title.includes('美食') || title.includes('做菜') || title.includes('吃')) {
    transcript += `${author}：今天给大家分享一道特别的美食。\n`;
    transcript += `观众：看起来很有食欲！\n`;
    transcript += `${author}：这道菜的秘诀在于调料的搭配，一定要掌握好火候。\n\n`;
  } else if (title.includes('搞笑') || title.includes('段子') || title.includes('笑')) {
    transcript += `${author}：来，给大家讲个有趣的事情。\n`;
    transcript += `观众：哈哈哈，太逗了！\n`;
    transcript += `${author}：这还不算什么，更搞笑的在后面呢。\n\n`;
  } else if (title.includes('教程') || title.includes('技巧') || title.includes('方法')) {
    transcript += `${author}：今天教大家一个实用的小技巧。\n`;
    transcript += `观众：学到了，马上试试！\n`;
    transcript += `${author}：记住关键步骤，其实很简单的。\n\n`;
  } else {
    transcript += `${author}：今天想和大家分享一些生活感悟。\n`;
    transcript += `观众：说得太对了！\n`;
    transcript += `${author}：生活就是要充满正能量。\n\n`;
  }
  
  // 中间部分
  if (duration > 20) {
    transcript += `${author}：看到大家这么支持我，真的很感动。\n`;
    transcript += `观众：主播加油！\n`;
    transcript += `${author}：谢谢大家，你们的支持是我最大的动力。\n\n`;
  }
  
  // 结尾
  transcript += `${author}：好了，今天的分享就到这里。\n`;
  transcript += `${author}：喜欢的朋友记得点赞关注，我们下期再见！`;
  
  return transcript;
}

// 使用通义千问生成分镜脚本
async function generateScriptWithQwen(videoInfo, env) {
  const prompt = `你是一位专业的视频分镜脚本创作者。请根据以下视频信息和转写内容，创作一个详细的分镜脚本。

视频信息：
- 标题：${videoInfo.title}
- 作者：${videoInfo.author}
- 时长：${videoInfo.duration}毫秒
- 播放量：${videoInfo.statistics.play_count || 0}
- 点赞数：${videoInfo.statistics.digg_count || 0}

转写内容：
${videoInfo.transcript}

请创作5-8个场景的分镜脚本，每个场景包含：
1. scene: 场景名称
2. time: 时间段（格式如 "0:00-0:15"）
3. visual: 画面描述
4. camera: 镜头运动（如"固定镜头"、"推进"、"拉远"等）
5. dialogue: 对话或旁白

请直接返回JSON数组格式，不要有其他说明文字。`;

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-max',
      messages: [
        { role: 'system', content: '你是一位专业的视频分镜脚本创作者。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    throw new Error('通义千问API调用失败');
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析脚本失败:', e);
  }
  
  // 默认脚本
  return [
    {
      scene: "场景1：开场",
      time: "0:00-0:05",
      visual: "标题画面淡入，展示视频主题",
      camera: "固定镜头",
      dialogue: "开场介绍"
    },
    {
      scene: "场景2：主体内容",
      time: "0:05-0:40",
      visual: "展示核心内容",
      camera: "多角度切换",
      dialogue: videoInfo.transcript.substring(0, 100) + "..."
    },
    {
      scene: "场景3：结尾",
      time: "0:40-0:45",
      visual: "总结画面，呼吁关注",
      camera: "拉远镜头",
      dialogue: "感谢观看，记得点赞关注"
    }
  ];
}

// 格式化时长
function formatDuration(milliseconds) {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}

// 格式化数量
function formatCount(count) {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万';
  }
  return count.toString();
}