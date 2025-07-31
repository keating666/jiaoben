/**
 * Cloudflare Worker - 简化版（仅使用通义千问，无需crypto）
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
          message: 'Worker正常运行',
          timestamp: new Date().toISOString(),
          path: path,
          configured: {
            tikhub: !!env.TIKHUB_API_TOKEN,
            qwen: !!env.QWEN_API_KEY
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 简化处理端点（无需ASR）
      if (path === '/api/process-simple' || path === '/api/process' || path === '/api/process/') {
        if (request.method !== 'POST') {
          return new Response(JSON.stringify({
            error: 'Method not allowed'
          }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('Processing request...');
        
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
        
        // 检查配置
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
        
        // 调用 TikHub API
        console.log('Calling TikHub API...');
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
            error: 'No video data found'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 查找音频URL
        let audioUrl = null;
        if (aweme.music?.play_url?.url_list) {
          for (const url of aweme.music.play_url.url_list) {
            if (url && url.includes('.mp3')) {
              audioUrl = url;
              break;
            }
          }
        }
        
        // 生成智能模拟转写内容（根据视频信息）
        const transcript = generateSmartTranscript(aweme.desc || '抖音视频', aweme);
        
        // 调用通义千问生成脚本
        console.log('Calling Qwen API...');
        const script = await generateScriptWithQwen({
          title: aweme.desc || '无标题',
          author: aweme.author?.nickname || '未知作者',
          transcript: transcript,
          duration: aweme.duration || 15000, // 毫秒
          statistics: aweme.statistics || {}
        }, env);
        
        return new Response(JSON.stringify({
          success: true,
          videoInfo: {
            title: aweme.desc || '无标题',
            author: aweme.author?.nickname || '未知作者',
            videoId: aweme.aweme_id || '未知ID',
            musicTitle: aweme.music?.title || '未知音乐',
            duration: Math.round((aweme.duration || 15000) / 1000) + '秒',
            statistics: {
              play: aweme.statistics?.play_count || 0,
              like: aweme.statistics?.digg_count || 0,
              comment: aweme.statistics?.comment_count || 0,
              share: aweme.statistics?.share_count || 0
            }
          },
          audioUrl: audioUrl,
          transcript: transcript,
          script: script,
          message: '处理成功（智能模拟版）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker is running! Available endpoints: /api/test, /api/process', {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      
      // 404 处理
      return new Response(JSON.stringify({
        error: 'Not Found',
        path: path,
        availableEndpoints: [
          '/api/test',
          '/api/process',
          '/api/process-simple'
        ]
      }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Worker error:', error);
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

// 生成智能模拟转写内容
function generateSmartTranscript(title, videoInfo) {
  // 根据视频标题和信息智能生成对话
  const duration = Math.round((videoInfo.duration || 15000) / 1000);
  const author = videoInfo.author?.nickname || '主播';
  
  // 分析标题关键词
  const keywords = {
    '美食': {
      opening: `${author}：今天给大家分享一道超简单的家常菜。`,
      middle: `观众：看起来很好吃！能详细说说做法吗？\n${author}：当然！这道菜的关键是调料的比例，大家要记好了。`,
      ending: `${author}：好了，今天的美食分享就到这里，喜欢的朋友记得点赞关注哦！`
    },
    '搞笑': {
      opening: `${author}：家人们，你们绝对想不到今天发生了什么！`,
      middle: `观众：哈哈哈笑死我了！\n${author}：对吧！当时我整个人都懵了。`,
      ending: `${author}：今天就分享到这里，下次再给大家带来更多有趣的内容！`
    },
    '教程': {
      opening: `${author}：大家好，今天教大家一个超实用的小技巧。`,
      middle: `观众：这个太有用了，收藏了！\n${author}：对，学会这个能省很多时间。`,
      ending: `${author}：如果觉得有帮助，记得三连支持一下！`
    },
    '产品': {
      opening: `${author}：姐妹们，今天要给大家推荐一个我最近发现的好物。`,
      middle: `观众：真的有那么好用吗？\n${author}：我已经用了一个月，效果真的很明显！`,
      ending: `${author}：需要的朋友可以看我主页链接，今天有优惠哦！`
    },
    '穿搭': {
      opening: `${author}：今天来分享一下我的日常穿搭。`,
      middle: `观众：这套也太好看了吧！\n${author}：这件上衣特别百搭，我买了好几个颜色。`,
      ending: `${author}：穿搭分享就到这里，我们下期见！`
    },
    '旅游': {
      opening: `${author}：带大家看看这个超美的地方！`,
      middle: `观众：这是哪里啊？好想去！\n${author}：这是我上周去的，真的强烈推荐！`,
      ending: `${author}：旅行攻略我放在评论区了，需要的自取哦！`
    }
  };
  
  // 查找匹配的关键词
  let selectedTemplate = null;
  for (const [keyword, template] of Object.entries(keywords)) {
    if (title.includes(keyword)) {
      selectedTemplate = template;
      break;
    }
  }
  
  // 如果没有匹配，使用通用模板
  if (!selectedTemplate) {
    selectedTemplate = {
      opening: `${author}：大家好，欢迎来到我的直播间！`,
      middle: `观众：主播好！今天分享什么呢？\n${author}：今天要给大家分享的内容特别精彩。`,
      ending: `${author}：感谢大家的观看，记得关注我哦！`
    };
  }
  
  // 根据视频时长调整内容
  let transcript = selectedTemplate.opening + '\n\n';
  
  if (duration > 10) {
    transcript += selectedTemplate.middle + '\n\n';
  }
  
  if (duration > 20) {
    transcript += `观众：学到了，谢谢分享！\n${author}：不客气，大家喜欢就好。\n\n`;
  }
  
  transcript += selectedTemplate.ending;
  
  return transcript;
}

// 调用通义千问API
async function callQwenAPI(prompt, env) {
  const endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: {
        messages: [{
          role: 'user',
          content: prompt
        }]
      },
      parameters: {
        max_tokens: 2000,
        temperature: 0.7
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Qwen API error: ${error}`);
  }
  
  const data = await response.json();
  return data.output?.text || data.output?.choices?.[0]?.message?.content || '无响应';
}

// 使用通义千问生成分镜脚本
async function generateScriptWithQwen(videoData, env) {
  const durationSeconds = Math.round((videoData.duration || 15000) / 1000);
  
  const prompt = `你是一位专业的短视频分镜脚本编剧。请根据以下信息生成一个详细的分镜脚本：

视频标题：${videoData.title}
作者：${videoData.author}
视频时长：${durationSeconds}秒
播放数据：${videoData.statistics.play || 0}次播放，${videoData.statistics.like || 0}个赞

对话内容：
${videoData.transcript}

请根据视频时长生成合适数量的场景（${durationSeconds}秒视频建议${Math.ceil(durationSeconds / 5)}个场景），每个场景包含：
1. 场景名称（如：开场介绍、主体展示、互动环节、结尾呼吁）
2. 时间段（根据总时长合理分配）
3. 画面描述（具体生动）
4. 镜头类型（特写、中景、远景、推拉摇移等）
5. 对话/旁白

请以JSON格式返回，格式如下：
[
  {
    "scene": "场景1：开场",
    "time": "0:00-0:05",
    "visual": "画面描述",
    "camera": "镜头类型",
    "dialogue": "对话内容"
  }
]`;
  
  try {
    const response = await callQwenAPI(prompt, env);
    
    // 尝试解析JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const script = JSON.parse(jsonMatch[0]);
        return Array.isArray(script) ? script : [script];
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }
    
    // 返回智能生成的默认脚本
    return generateDefaultScript(videoData, durationSeconds);
    
  } catch (error) {
    console.error('Generate script error:', error);
    return generateDefaultScript(videoData, durationSeconds);
  }
}

// 生成默认脚本
function generateDefaultScript(videoData, durationSeconds) {
  const scenes = [];
  const sceneCount = Math.max(3, Math.min(6, Math.ceil(durationSeconds / 5)));
  const timePerScene = Math.floor(durationSeconds / sceneCount);
  
  const lines = videoData.transcript.split('\n').filter(line => line.trim());
  
  for (let i = 0; i < sceneCount; i++) {
    const startTime = i * timePerScene;
    const endTime = Math.min((i + 1) * timePerScene, durationSeconds);
    
    let sceneName, visual, camera;
    
    if (i === 0) {
      sceneName = '开场介绍';
      visual = '主播出镜，面带微笑，背景整洁';
      camera = '中景，缓慢推进';
    } else if (i === sceneCount - 1) {
      sceneName = '结尾互动';
      visual = '主播做总结，屏幕显示关注提示';
      camera = '特写，固定镜头';
    } else {
      sceneName = `主体展示${i}`;
      visual = '展示具体内容，配合手势讲解';
      camera = i % 2 === 0 ? '特写镜头' : '中景切换';
    }
    
    scenes.push({
      scene: `场景${i + 1}：${sceneName}`,
      time: `0:${String(startTime).padStart(2, '0')}-0:${String(endTime).padStart(2, '0')}`,
      visual: visual,
      camera: camera,
      dialogue: lines[i] || '继续展示内容'
    });
  }
  
  return scenes;
}