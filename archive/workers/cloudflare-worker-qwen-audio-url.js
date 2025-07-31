/**
 * Cloudflare Worker - 通义千问Audio版本
 * 直接使用音频URL进行识别，无需下载
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
          message: 'Worker正常运行 - 通义千问Audio URL版本',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            qwenAudio: !!env.TONGYI_API_KEY,
            tikhub: !!env.TIKHUB_API_TOKEN,
            audioFromURL: true
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
        
        if (!env.TONGYI_API_KEY) {
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
        let audioUrls = [];
        
        // 收集所有可能的音频URL
        if (aweme.music?.play_url?.url_list?.length > 0) {
          audioUrls.push(...aweme.music.play_url.url_list);
        }
        if (aweme.video?.play_addr?.url_list?.length > 0) {
          audioUrls.push(...aweme.video.play_addr.url_list);
        }
        
        console.log(`找到 ${audioUrls.length} 个可能的音频URL`);
        
        // 步骤3：使用通义千问Audio识别
        let transcript = '';
        let asrUsed = false;
        let asrError = null;
        
        if (audioUrls.length > 0) {
          console.log('步骤3: 使用通义千问Audio进行语音识别...');
          
          // 尝试每个URL直到成功
          for (const url of audioUrls) {
            try {
              console.log(`尝试URL: ${url.substring(0, 50)}...`);
              
              // 调用通义千问Audio API
              const audioResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${env.TONGYI_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: 'qwen-audio-turbo-latest',
                  input: {
                    messages: [
                      {
                        role: 'user',
                        content: [
                          { audio: url },  // 直接传入音频URL
                          { text: '请将这段音频完整转写成文字，包括所有对话内容。' }
                        ]
                      }
                    ]
                  }
                })
              });
              
              if (audioResponse.ok) {
                const audioData = await audioResponse.json();
                if (audioData.output?.choices?.[0]?.message?.content) {
                  transcript = audioData.output.choices[0].message.content;
                  asrUsed = true;
                  audioUrl = url;
                  console.log('通义千问Audio识别成功！');
                  break;
                }
              } else {
                const errorText = await audioResponse.text();
                console.error(`通义千问Audio失败: ${errorText}`);
                asrError = errorText;
              }
            } catch (error) {
              console.error(`URL失败: ${error.message}`);
              asrError = error.message;
              continue;
            }
          }
        }
        
        // 如果音频识别失败，使用智能生成
        if (!asrUsed) {
          console.log('音频识别未成功，使用智能生成...');
          transcript = await generateSmartTranscript(aweme, env);
        }
        
        // 步骤4：生成分镜脚本
        console.log('步骤4: 生成分镜脚本...');
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
          asrUsed: asrUsed,
          asrError: asrError,
          message: asrUsed ? '处理完成（通义千问Audio语音识别）' : '处理完成（智能生成）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - 通义千问Audio URL版本', {
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

// 智能生成转写内容
async function generateSmartTranscript(aweme, env) {
  const videoContext = {
    title: aweme.desc || '无标题',
    author: aweme.author?.nickname || '未知作者',
    duration: Math.round((aweme.duration || 15000) / 1000),
    musicTitle: aweme.music?.title || aweme.music?.album || '原声',
    hashtags: aweme.text_extra?.filter(t => t.type === 1).map(t => t.hashtag_name) || []
  };
  
  const prompt = `根据以下抖音视频信息，生成一份真实的对话转写：
标题：${videoContext.title}
作者：${videoContext.author}
时长：${videoContext.duration}秒
音乐：${videoContext.musicTitle}
标签：${videoContext.hashtags.join(', ') || '无'}

请生成符合视频内容的对话，要自然真实。`;

  const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.QWEN_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen-max',
      messages: [
        { role: 'system', content: '你是一位专业的视频内容分析师。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 1000
    })
  });

  if (response.ok) {
    const data = await response.json();
    return data.choices[0].message.content;
  }
  
  // 默认转写
  return `${videoContext.author}：大家好，欢迎观看我的视频。\n今天给大家分享的内容是：${videoContext.title}\n希望大家喜欢，记得点赞关注哦！`;
}

// 生成分镜脚本
async function generateScriptWithQwen(videoInfo, env) {
  const prompt = `请根据以下视频转写内容，创作5-8个场景的分镜脚本。
视频标题：${videoInfo.title}
转写内容：${videoInfo.transcript}

每个场景包含：scene(场景名称)、time(时间段)、visual(画面描述)、camera(镜头运动)、dialogue(对话)
直接返回JSON数组格式。`;

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.QWEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-max',
        messages: [
          { role: 'system', content: '你是专业的视频分镜脚本创作者。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error('生成脚本失败:', error);
  }
  
  // 默认脚本
  return [
    {
      scene: "场景1：开场",
      time: "0:00-0:05",
      visual: "视频开场画面",
      camera: "固定镜头",
      dialogue: "开场白"
    },
    {
      scene: "场景2：主体",
      time: "0:05-0:40",
      visual: "主要内容展示",
      camera: "多角度切换",
      dialogue: videoInfo.transcript.substring(0, 100) + "..."
    },
    {
      scene: "场景3：结尾",
      time: "0:40-0:45",
      visual: "结束画面",
      camera: "拉远",
      dialogue: "感谢观看"
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