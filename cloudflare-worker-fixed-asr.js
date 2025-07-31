/**
 * Cloudflare Worker - 修复版（使用 Node.js crypto）
 * 需要在 wrangler.toml 中添加: compatibility_flags = ["nodejs_compat"]
 */

import crypto from 'node:crypto';

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
          message: 'Worker正常运行 - 修复版（使用Node.js crypto）',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            realASR: !!(env.ALIYUN_ACCESS_KEY_ID && env.ALIYUN_ACCESS_KEY_SECRET && env.ALIYUN_APP_KEY),
            aiGeneration: !!env.QWEN_API_KEY,
            tikhub: !!env.TIKHUB_API_TOKEN,
            cryptoSupport: 'nodejs'
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
        // 最后尝试使用无水印视频
        else if (aweme.video?.play_addr_264?.url_list?.length > 0) {
          audioUrl = aweme.video.play_addr_264.url_list[0];
        } else {
          const allUrls = [];
          if (aweme.video?.play_addr?.url_list) {
            allUrls.push(...aweme.video.play_addr.url_list);
          }
          if (aweme.video?.download_addr?.url_list) {
            allUrls.push(...aweme.video.download_addr.url_list);
          }
          if (allUrls.length > 0) {
            audioUrl = allUrls[0];
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
          message: asrUsed ? '处理完成（真实语音识别）' : '处理完成（智能模拟）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // ASR调试端点
      if (path === '/api/debug-asr' || path === '/api/debug-asr/') {
        const body = await request.json();
        const audioUrl = body.audioUrl || 'https://sf6-cdn-tos.douyinstatic.com/obj/ies-music/7531294223631846198.mp3';
        
        const debugInfo = {
          audioUrl: audioUrl,
          timestamp: new Date().toISOString(),
          envCheck: {
            hasAccessKeyId: !!env.ALIYUN_ACCESS_KEY_ID,
            hasAccessKeySecret: !!env.ALIYUN_ACCESS_KEY_SECRET,
            hasAppKey: !!env.ALIYUN_APP_KEY
          },
          steps: []
        };
        
        try {
          // 步骤1：获取Token
          debugInfo.steps.push({ step: '获取Token', status: '开始' });
          const token = await getAliyunToken(env);
          debugInfo.steps.push({ step: '获取Token', status: '成功', token: token.substring(0, 20) + '...' });
          
          // 步骤2：提交ASR任务
          debugInfo.steps.push({ step: '提交ASR任务', status: '开始' });
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
          
          const taskText = await taskResponse.text();
          debugInfo.steps.push({ 
            step: '提交ASR任务', 
            status: taskResponse.ok ? '成功' : '失败',
            responseStatus: taskResponse.status,
            response: taskText
          });
          
          if (!taskResponse.ok) {
            throw new Error(`ASR提交失败: ${taskText}`);
          }
          
          const taskData = JSON.parse(taskText);
          const taskId = taskData.task_id;
          debugInfo.taskId = taskId;
          
          // 步骤3：查询结果（只查询3次作为测试）
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const resultResponse = await fetch(
              `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=${env.ALIYUN_APP_KEY}&task_id=${taskId}`,
              {
                headers: {
                  'X-NLS-Token': token,
                  'Accept': 'application/json'
                }
              }
            );
            
            const resultText = await resultResponse.text();
            const resultData = JSON.parse(resultText);
            
            debugInfo.steps.push({
              step: `查询结果 #${i + 1}`,
              status: resultData.status || resultData.status_code,
              response: resultData
            });
            
            if (resultData.status === 'SUCCESS' || resultData.status_code === 21000000) {
              debugInfo.transcript = resultData.result || resultData.text;
              break;
            }
          }
          
        } catch (error) {
          debugInfo.error = {
            message: error.message,
            stack: error.stack
          };
        }
        
        return new Response(JSON.stringify(debugInfo, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - Fixed with Node.js crypto', {
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
  
  // 移除空白字符
  url = url.trim();
  
  // 处理各种抖音链接格式
  const patterns = [
    // 短链接：支持包含下划线、连字符等特殊字符
    /https?:\/\/v\.douyin\.com\/[A-Za-z0-9_\-]+/,
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
      
      // 移除尾部的特殊字符（但保留下划线和连字符）
      cleanUrl = cleanUrl.replace(/[^\w\/:._-]+$/, '');
      
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

// 使用 Node.js crypto 获取阿里云 Token
async function getAliyunToken(env) {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2);
  
  // 构建请求参数
  const params = {
    Version: '2019-02-28',
    Action: 'CreateToken',
    Format: 'JSON',
    RegionId: 'cn-shanghai',
    Timestamp: timestamp,  // 毫秒级时间戳
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    AccessKeyId: env.ALIYUN_ACCESS_KEY_ID
  };
  
  // 对参数排序
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  // 构建签名字符串
  const stringToSign = `POST&%2F&${encodeURIComponent(sortedParams)}`;
  
  // 使用 Node.js crypto 计算 HMAC-SHA1
  const signature = crypto
    .createHmac('sha1', env.ALIYUN_ACCESS_KEY_SECRET + '&')
    .update(stringToSign, 'utf8')
    .digest('base64');
  
  // 添加签名到参数
  params.Signature = signature;
  
  const response = await fetch('https://nls-meta.cn-shanghai.aliyuncs.com/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-acs-action': 'CreateToken',
      'x-acs-version': '2019-02-28',
      'x-acs-timestamp': String(timestamp)
    },
    body: new URLSearchParams(params).toString()
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
      opening: `${author}：大家好，今天给大家带来一个搞笑的故事。`,
      middle: `观众：哈哈哈太逗了！\n${author}：还有更好笑的呢，你们听我说...`,
      ending: `${author}：谢谢大家的支持，记得点赞关注哦！`
    },
    '教程': {
      opening: `${author}：今天教大家一个超实用的小技巧。`,
      middle: `观众：学到了！\n${author}：这个方法特别简单，大家跟着我一步步来。`,
      ending: `${author}：怎么样，是不是很简单？赶紧试试吧！`
    },
    '生活': {
      opening: `${author}：分享一下今天发生的有趣事情。`,
      middle: `观众：太真实了！\n${author}：对吧，生活就是这样充满惊喜。`,
      ending: `${author}：感谢大家的陪伴，我们下次再见！`
    }
  };
  
  // 根据标题智能选择类型
  let type = '生活';
  for (const [key, value] of Object.entries(keywords)) {
    if (title.includes(key) || title.includes(key.substring(0, 1))) {
      type = key;
      break;
    }
  }
  
  const template = keywords[type];
  
  // 生成基于时长的转写内容
  let transcript = `${template.opening}\n\n`;
  
  if (duration > 10) {
    transcript += `${template.middle}\n\n`;
  }
  
  if (duration > 20) {
    transcript += `${author}：大家有什么想法可以在评论区告诉我。\n\n`;
  }
  
  transcript += template.ending;
  
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
    // 尝试提取JSON数组
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('解析脚本失败:', e);
  }
  
  // 如果解析失败，返回默认脚本
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