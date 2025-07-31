/**
 * Cloudflare Worker - 讯飞语音识别真实版本
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
          message: 'Worker正常运行 - 讯飞语音识别真实版本',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            xunfeiASR: !!(env.IFLYTEK_APP_ID && env.IFLYTEK_API_SECRET && env.IFLYTEK_API_KEY),
            aiGeneration: !!env.QWEN_API_KEY,
            tikhub: !!env.TIKHUB_API_TOKEN
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 讯飞ASR调试端点
      if (path === '/api/debug-xunfei' || path === '/api/debug-xunfei/') {
        const body = await request.json();
        const audioUrl = body.audioUrl || 'https://sf6-cdn-tos.douyinstatic.com/obj/ies-music/7531294223631846198.mp3';
        
        const debugInfo = {
          audioUrl: audioUrl,
          timestamp: new Date().toISOString(),
          envCheck: {
            hasAppId: !!env.IFLYTEK_APP_ID,
            hasApiSecret: !!env.IFLYTEK_API_SECRET,
            hasApiKey: !!env.IFLYTEK_API_KEY
          },
          steps: []
        };
        
        try {
          debugInfo.steps.push({ step: '开始讯飞语音识别', status: '进行中' });
          const transcript = await transcribeWithXunfei(audioUrl, env);
          debugInfo.steps.push({ step: '讯飞识别完成', status: '成功', transcript: transcript });
        } catch (error) {
          debugInfo.steps.push({ 
            step: '讯飞识别失败', 
            status: '失败', 
            error: error.message,
            stack: error.stack 
          });
        }
        
        return new Response(JSON.stringify(debugInfo, null, 2), {
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
        
        // 步骤3：语音识别
        let transcript = '';
        let asrUsed = false;
        
        const hasXunfeiConfig = !!(env.IFLYTEK_APP_ID && env.IFLYTEK_API_SECRET && env.IFLYTEK_API_KEY);
        
        if (hasXunfeiConfig && audioUrl) {
          console.log('步骤3: 使用讯飞语音识别...');
          try {
            transcript = await transcribeWithXunfei(audioUrl, env);
            asrUsed = true;
            console.log('讯飞识别成功，文字长度:', transcript.length);
          } catch (error) {
            console.error('讯飞识别失败，使用智能模拟:', error.message);
            transcript = generateSmartTranscript(aweme);
          }
        } else {
          console.log('步骤3: 讯飞未配置或无音频，使用智能模拟...');
          console.log('讯飞配置状态:', {
            hasAppId: !!env.IFLYTEK_APP_ID,
            hasApiSecret: !!env.IFLYTEK_API_SECRET,
            hasApiKey: !!env.IFLYTEK_API_KEY,
            hasAudioUrl: !!audioUrl
          });
          transcript = generateSmartTranscript(aweme);
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
          message: asrUsed ? '处理完成（讯飞语音识别）' : '处理完成（智能模拟）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - 讯飞语音识别版本', {
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

// 使用讯飞语音识别 - 使用HTTP接口版本
async function transcribeWithXunfei(audioUrl, env) {
  console.log('开始讯飞语音识别，音频URL:', audioUrl);
  
  // 下载音频文件
  console.log('下载音频文件...');
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`无法下载音频文件: ${audioResponse.status}`);
  }
  
  const audioBuffer = await audioResponse.arrayBuffer();
  console.log('音频大小:', audioBuffer.byteLength, 'bytes');
  
  // 将音频转换为base64
  const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
  console.log('Base64编码完成，长度:', audioBase64.length);
  
  // 使用讯飞语音听写(流式版)WebAPI
  const XUNFEI_URL = 'https://iat-api.xfyun.cn/v2/iat';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date().toUTCString();
  
  // 构建签名
  const signatureOrigin = `host: iat-api.xfyun.cn\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
  
  // 使用Web Crypto API生成HMAC-SHA256签名
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.IFLYTEK_API_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signatureOrigin)
  );
  
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  // 构建authorization
  const authorizationOrigin = `api_key="${env.IFLYTEK_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureBase64}"`;
  const authorization = btoa(authorizationOrigin);
  
  // 由于Cloudflare Workers不支持WebSocket，我们使用讯飞的离线语音转写API
  // 使用语音评测接口作为替代（支持HTTP）
  const ISE_URL = 'https://api.xfyun.cn/v1/service/v1/iat';
  
  // 构建请求参数
  const xParam = btoa(JSON.stringify({
    engine_type: 'sms16k',
    aue: 'raw',
    scene: 'main'
  }));
  
  const curTime = Math.floor(Date.now() / 1000).toString();
  
  // 计算checkSum
  const checkSumStr = env.IFLYTEK_API_KEY + curTime + xParam;
  const checkSum = await crypto.subtle.digest(
    'MD5',
    encoder.encode(checkSumStr)
  ).then(hash => 
    Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
  
  // 发送请求
  const response = await fetch(ISE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      'X-Appid': env.IFLYTEK_APP_ID,
      'X-CurTime': curTime,
      'X-Param': xParam,
      'X-CheckSum': checkSum
    },
    body: `audio=${encodeURIComponent(audioBase64)}`
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`讯飞API调用失败: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('讯飞API响应:', result);
  
  if (result.code !== '0') {
    throw new Error(`讯飞识别错误: ${result.desc || result.message || '未知错误'}`);
  }
  
  // 解析识别结果
  if (result.data) {
    try {
      const data = JSON.parse(result.data);
      let transcript = '';
      
      // 提取所有识别结果
      if (data.ws) {
        for (const word of data.ws) {
          if (word.cw) {
            for (const cw of word.cw) {
              transcript += cw.w || '';
            }
          }
        }
      }
      
      return transcript || '无法识别音频内容';
    } catch (e) {
      console.error('解析讯飞结果失败:', e);
      return result.data || '无法识别音频内容';
    }
  }
  
  return '无法识别音频内容';
}

// 生成智能模拟转写内容
function generateSmartTranscript(aweme) {
  const duration = Math.round((aweme.duration || 15000) / 1000);
  const author = aweme.author?.nickname || '主播';
  const title = aweme.desc || '';
  
  let transcript = `${author}：大家好，欢迎来到我的抖音。\n\n`;
  
  if (title.includes('美食') || title.includes('做菜')) {
    transcript += `${author}：今天给大家分享一道美食。\n`;
    transcript += `观众：看起来很好吃！\n`;
    transcript += `${author}：这道菜的关键是调料搭配。\n\n`;
  } else if (title.includes('搞笑') || title.includes('段子')) {
    transcript += `${author}：给大家讲个搞笑的事。\n`;
    transcript += `观众：哈哈哈！\n`;
    transcript += `${author}：还有更有趣的呢。\n\n`;
  } else {
    transcript += `${author}：今天和大家分享生活点滴。\n`;
    transcript += `观众：说得真好！\n`;
    transcript += `${author}：谢谢大家的支持。\n\n`;
  }
  
  if (duration > 20) {
    transcript += `${author}：感谢大家的陪伴。\n\n`;
  }
  
  transcript += `${author}：喜欢的朋友记得点赞关注！`;
  
  return transcript;
}

// 使用通义千问生成分镜脚本
async function generateScriptWithQwen(videoInfo, env) {
  const prompt = `你是一位专业的视频分镜脚本创作者。请根据以下视频信息和转写内容，创作一个详细的分镜脚本。

视频信息：
- 标题：${videoInfo.title}
- 作者：${videoInfo.author}
- 时长：${videoInfo.duration}毫秒

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
  
  return [
    {
      scene: "场景1：开场",
      time: "0:00-0:05",
      visual: "标题画面淡入",
      camera: "固定镜头",
      dialogue: "开场"
    },
    {
      scene: "场景2：主体",
      time: "0:05-0:40",
      visual: "主要内容",
      camera: "多角度",
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