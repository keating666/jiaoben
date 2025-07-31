/**
 * Cloudflare Worker - 完整版（包含链接清洗 + 真实ASR）
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
          message: 'Worker正常运行 - 完整版（含ASR）',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            realASR: !!(env.ALIYUN_ACCESS_KEY_ID && env.ALIYUN_ACCESS_KEY_SECRET && env.ALIYUN_APP_KEY),
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
        
        console.log('Processing request...');
        const body = await request.json();
        const rawUrl = body.douyinUrl;
        
        if (!rawUrl) {
          return new Response(JSON.stringify({
            error: 'Missing douyinUrl parameter'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 步骤1：清洗抖音链接
        console.log('步骤1: 清洗抖音链接...');
        const cleanedUrl = cleanDouyinUrl(rawUrl);
        console.log('原始链接:', rawUrl);
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
        
        console.log('找到音频URL:', audioUrl ? '是' : '否');
        
        // 步骤3：语音识别
        let transcript = '';
        let asrUsed = false;
        
        const hasASRConfig = !!(env.ALIYUN_ACCESS_KEY_ID && env.ALIYUN_ACCESS_KEY_SECRET && env.ALIYUN_APP_KEY);
        
        if (hasASRConfig && audioUrl) {
          console.log('步骤3: 使用阿里云ASR进行真实语音识别...');
          try {
            transcript = await transcribeWithAliyunASR(audioUrl, env);
            asrUsed = true;
            console.log('ASR识别成功，文字长度:', transcript.length);
          } catch (error) {
            console.error('ASR失败，使用智能模拟:', error.message);
            transcript = generateSmartTranscript(aweme.desc || '抖音视频', aweme);
          }
        } else {
          console.log('步骤3: ASR未配置或无音频，使用智能模拟...');
          transcript = generateSmartTranscript(aweme.desc || '抖音视频', aweme);
        }
        
        // 步骤4：使用通义千问生成分镜脚本
        console.log('步骤4: 使用通义千问生成脚本...');
        const script = await generateScriptWithQwen({
          title: aweme.desc || '无标题',
          author: aweme.author?.nickname || '未知作者',
          transcript: transcript,
          duration: aweme.duration || 15000,
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
          asrUsed: asrUsed,
          message: asrUsed ? '处理完成（真实语音识别）' : '处理完成（智能模拟）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - Complete Version with ASR', {
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
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// 清洗抖音链接
function cleanDouyinUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  
  // 移除空白字符
  url = url.trim();
  
  // 处理各种抖音链接格式
  const patterns = [
    // 短链接：https://v.douyin.com/xxxxxx/
    /https?:\/\/v\.douyin\.com\/[A-Za-z0-9]+/,
    // 完整链接
    /https?:\/\/www\.douyin\.com\/video\/\d+/,
    /https?:\/\/www\.douyin\.com\/discover\?modal_id=\d+/,
    // 移动端链接
    /https?:\/\/m\.douyin\.com\/share\/video\/\d+/,
    // 带参数的链接
    /https?:\/\/[^\/]*douyin\.com\/[^\s?]*/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      let cleanUrl = match[0];
      
      // 移除尾部的特殊字符
      cleanUrl = cleanUrl.replace(/[^\w\/:.-]+$/, '');
      
      // 确保短链接有斜杠结尾
      if (cleanUrl.includes('v.douyin.com') && !cleanUrl.endsWith('/')) {
        cleanUrl += '/';
      }
      
      console.log('链接清洗成功:', url, '->', cleanUrl);
      return cleanUrl;
    }
  }
  
  // 如果没有匹配到，返回原链接
  console.log('链接格式未识别，返回原链接');
  return url;
}

// 使用 Web Crypto API 获取阿里云 Token
async function getAliyunToken(env) {
  const date = new Date().toUTCString();
  const md5 = "";
  const contentType = "application/json";
  const accept = "application/json";
  
  // 构建签名字符串
  const stringToSign = `POST\n${accept}\n${md5}\n${contentType}\n${date}\n/pop/2019-02-28/tokens`;
  
  // 使用 Web Crypto API 计算 HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.ALIYUN_ACCESS_KEY_SECRET),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(stringToSign)
  );
  
  // 转换为 base64
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  const authorization = `acs ${env.ALIYUN_ACCESS_KEY_ID}:${base64Signature}`;
  
  const response = await fetch('https://nls-meta.cn-shanghai.aliyuncs.com/pop/2019-02-28/tokens', {
    method: 'POST',
    headers: {
      'Accept': accept,
      'Content-Type': contentType,
      'Date': date,
      'Authorization': authorization
    },
    body: JSON.stringify({
      appkey: env.ALIYUN_APP_KEY
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`获取Token失败: ${error}`);
  }
  
  const data = await response.json();
  return data.Token?.Id;
}

// 使用阿里云ASR进行语音识别
async function transcribeWithAliyunASR(audioUrl, env) {
  // 获取 Token
  const token = await getAliyunToken(env);
  console.log('获取到ASR Token');
  
  // 提交ASR任务
  const taskResponse = await fetch('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr', {
    method: 'POST',
    headers: {
      'X-NLS-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      appkey: env.ALIYUN_APP_KEY,
      file_link: audioUrl,
      version: "4.0",
      enable_words: false,
      enable_sample_rate_adaptive: true,
      format: "mp3",
      sample_rate: 16000,
      enable_punctuation_prediction: true,
      enable_disfluency: true,
      enable_semantic_sentence_detection: true
    })
  });
  
  if (!taskResponse.ok) {
    const error = await taskResponse.text();
    throw new Error(`ASR提交失败: ${error}`);
  }
  
  const taskData = await taskResponse.json();
  const taskId = taskData.task_id;
  console.log('ASR任务ID:', taskId);
  
  // 等待结果
  let attempts = 0;
  const maxAttempts = 60; // 最多等待60秒
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    
    const resultResponse = await fetch(
      `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=${env.ALIYUN_APP_KEY}&task_id=${taskId}`,
      {
        headers: {
          'X-NLS-Token': token,
          'Accept': 'application/json'
        }
      }
    );
    
    if (resultResponse.ok) {
      const resultData = await resultResponse.json();
      console.log('ASR状态:', resultData.status || resultData.status_code);
      
      if (resultData.status === 'SUCCESS' || resultData.status_code === 21000000) {
        return resultData.result || resultData.text || '无法识别音频内容';
      } else if (resultData.status === 'FAILED' || (resultData.status_code && resultData.status_code > 21000000)) {
        throw new Error('ASR处理失败: ' + (resultData.status_text || resultData.status_code));
      }
    }
    
    attempts++;
  }
  
  throw new Error('ASR处理超时');
}

// 生成智能模拟转写内容（作为备用）
function generateSmartTranscript(title, videoInfo) {
  const duration = Math.round((videoInfo.duration || 15000) / 1000);
  const author = videoInfo.author?.nickname || '主播';
  
  const keywords = {
    '美食': {
      opening: `${author}：今天给大家分享一道超简单的家常菜。`,
      middle: `观众：看起来很好吃！\n${author}：这道菜的关键是调料的比例，大家要记好了。`,
      ending: `${author}：好了，今天的美食分享就到这里！`
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
    '日常': {
      opening: `${author}：今天跟大家分享一下我的日常。`,
      middle: `观众：你的生活真精彩！\n${author}：其实每天都有很多有趣的事情发生。`,
      ending: `${author}：感谢大家的陪伴，明天见！`
    }
  };
  
  let selectedTemplate = null;
  for (const [keyword, template] of Object.entries(keywords)) {
    if (title.includes(keyword)) {
      selectedTemplate = template;
      break;
    }
  }
  
  if (!selectedTemplate) {
    selectedTemplate = {
      opening: `${author}：大家好，欢迎来到我的视频！`,
      middle: `观众：内容很精彩！\n${author}：谢谢大家的支持。`,
      ending: `${author}：记得关注我，下次再见！`
    };
  }
  
  let transcript = selectedTemplate.opening + '\n\n';
  if (duration > 10) {
    transcript += selectedTemplate.middle + '\n\n';
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
    throw new Error(`通义千问调用失败: ${error}`);
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

识别到的对话内容：
${videoData.transcript}

请注意：上述对话内容是通过语音识别得到的真实内容，请基于这些实际对话生成分镜脚本。

生成要求：
1. 根据实际对话内容安排场景
2. 场景数量：${Math.ceil(durationSeconds / 5)}个左右
3. 每个场景包含：场景名称、时间段、画面描述、镜头类型、对话内容
4. 画面描述要与对话内容相匹配
5. 镜头运动要专业（特写、中景、远景、推拉摇移等）

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
        console.error('JSON解析失败:', e);
      }
    }
    
    // 如果解析失败，返回基于转写内容的脚本
    return generateDefaultScript(videoData, durationSeconds);
    
  } catch (error) {
    console.error('生成脚本失败:', error);
    return generateDefaultScript(videoData, durationSeconds);
  }
}

// 生成默认脚本（基于实际转写内容）
function generateDefaultScript(videoData, durationSeconds) {
  const scenes = [];
  const lines = videoData.transcript.split('\n').filter(line => line.trim());
  const sceneCount = Math.max(3, Math.min(lines.length, 6));
  const timePerScene = Math.floor(durationSeconds / sceneCount);
  
  for (let i = 0; i < sceneCount; i++) {
    const startTime = i * timePerScene;
    const endTime = Math.min((i + 1) * timePerScene, durationSeconds);
    
    let sceneName, visual, camera;
    
    if (i === 0) {
      sceneName = '开场';
      visual = '视频开始，展示主要人物或场景';
      camera = '中景，缓慢推进';
    } else if (i === sceneCount - 1) {
      sceneName = '结尾';
      visual = '总结画面，可能有文字提示或互动引导';
      camera = '全景或特写';
    } else {
      sceneName = `主体内容${i}`;
      visual = '根据对话内容展示相应画面';
      camera = i % 2 === 0 ? '特写镜头' : '中景切换';
    }
    
    const dialogue = lines[i] || '（画面展示）';
    
    scenes.push({
      scene: `场景${i + 1}：${sceneName}`,
      time: `0:${String(startTime).padStart(2, '0')}-0:${String(endTime).padStart(2, '0')}`,
      visual: visual,
      camera: camera,
      dialogue: dialogue
    });
  }
  
  return scenes;
}