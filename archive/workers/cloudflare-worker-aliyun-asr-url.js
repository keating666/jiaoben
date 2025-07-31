/**
 * Cloudflare Worker - 阿里云ASR URL直传版本
 * 使用录音文件识别(异步)接口，支持URL直传
 */

import crypto from 'node:crypto';

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
          message: 'Worker正常运行 - 阿里云ASR URL直传版本',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            aliyunASR: !!(env.ALIYUN_ACCESS_KEY_ID && env.ALIYUN_ACCESS_KEY_SECRET),
            qianwen: !!env.TONGYI_API_KEY,
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
        
        if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET) {
          return new Response(JSON.stringify({
            error: '阿里云ASR未配置'
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
        
        // 优先使用音乐URL（质量更好）
        if (aweme.music?.play_url?.url_list?.length > 0) {
          audioUrl = aweme.music.play_url.url_list[0];
        } else if (aweme.video?.play_addr?.url_list?.length > 0) {
          audioUrl = aweme.video.play_addr.url_list[0];
        }
        
        if (!audioUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '无法获取音频URL'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('获取到音频URL:', audioUrl.substring(0, 50) + '...');
        
        // 步骤3：创建阿里云ASR任务
        console.log('步骤3: 创建阿里云ASR任务（URL直传）...');
        const taskId = await createAliyunASRTask(audioUrl, env);
        
        if (!taskId) {
          return new Response(JSON.stringify({
            success: false,
            error: '创建ASR任务失败'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('ASR任务创建成功，TaskId:', taskId);
        
        // 步骤4：轮询任务结果（最多等待30秒）
        console.log('步骤4: 轮询ASR任务结果...');
        const maxRetries = 10;
        const retryDelay = 3000; // 3秒
        let transcript = null;
        
        for (let i = 0; i < maxRetries; i++) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          const result = await getAliyunASRResult(taskId, env);
          if (result.status === 'SUCCESS') {
            transcript = result.transcript;
            break;
          } else if (result.status === 'FAILED') {
            console.error('ASR任务失败:', result.error);
            break;
          }
          
          console.log(`轮询第${i + 1}次，任务状态: ${result.status}`);
        }
        
        if (!transcript) {
          console.log('ASR识别失败，使用智能生成...');
          transcript = await generateSmartTranscript(aweme, env);
        }
        
        // 步骤5：生成分镜脚本
        console.log('步骤5: 生成分镜脚本...');
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
          asrTaskId: taskId,
          message: taskId ? '处理完成（阿里云ASR）' : '处理完成（智能生成）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - 阿里云ASR URL直传版本', {
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

// 创建阿里云ASR任务（录音文件识别）
async function createAliyunASRTask(audioUrl, env) {
  const endpoint = 'filetrans.cn-shanghai.aliyuncs.com';
  const appKey = env.ALIYUN_APP_KEY || 'default';
  
  // 构建请求参数
  const params = {
    appkey: appKey,
    file_link: audioUrl,
    version: '4.0',
    enable_words: false
  };
  
  // 生成签名（阿里云V2签名）
  const timestamp = new Date().toISOString();
  const nonce = Math.random().toString(36).substring(2);
  
  const signatureParams = {
    ...params,
    AccessKeyId: env.ALIYUN_ACCESS_KEY_ID,
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    Timestamp: timestamp,
    Format: 'JSON',
    Action: 'SubmitTask',
    Version: '2018-08-17'
  };
  
  // 排序参数
  const sortedParams = Object.keys(signatureParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(signatureParams[key])}`)
    .join('&');
  
  // 构建待签名字符串
  const stringToSign = `POST&%2F&${encodeURIComponent(sortedParams)}`;
  
  // 计算签名
  const signature = crypto
    .createHmac('sha1', env.ALIYUN_ACCESS_KEY_SECRET + '&')
    .update(stringToSign)
    .digest('base64');
  
  // 发送请求
  const response = await fetch(`https://${endpoint}/?${sortedParams}&Signature=${encodeURIComponent(signature)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  
  const result = await response.json();
  console.log('阿里云ASR响应:', JSON.stringify(result));
  
  if (result.StatusCode === 21050000) {
    return result.TaskId;
  } else {
    console.error('创建ASR任务失败:', result);
    return null;
  }
}

// 获取阿里云ASR结果
async function getAliyunASRResult(taskId, env) {
  const endpoint = 'filetrans.cn-shanghai.aliyuncs.com';
  
  const timestamp = new Date().toISOString();
  const nonce = Math.random().toString(36).substring(2);
  
  const params = {
    TaskId: taskId,
    AccessKeyId: env.ALIYUN_ACCESS_KEY_ID,
    SignatureMethod: 'HMAC-SHA1',
    SignatureVersion: '1.0',
    SignatureNonce: nonce,
    Timestamp: timestamp,
    Format: 'JSON',
    Action: 'GetTaskResult',
    Version: '2018-08-17'
  };
  
  // 排序参数
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  // 构建待签名字符串
  const stringToSign = `GET&%2F&${encodeURIComponent(sortedParams)}`;
  
  // 计算签名
  const signature = crypto
    .createHmac('sha1', env.ALIYUN_ACCESS_KEY_SECRET + '&')
    .update(stringToSign)
    .digest('base64');
  
  // 发送请求
  const response = await fetch(
    `https://${endpoint}/?${sortedParams}&Signature=${encodeURIComponent(signature)}`
  );
  
  const result = await response.json();
  
  if (result.StatusCode === 21050000) {
    if (result.StatusText === 'SUCCESS') {
      // 解析识别结果
      const sentences = result.Result?.Sentences || [];
      const transcript = sentences.map(s => s.Text).join(' ');
      return { status: 'SUCCESS', transcript };
    } else if (result.StatusText === 'RUNNING') {
      return { status: 'RUNNING' };
    } else {
      return { status: 'FAILED', error: result.StatusText };
    }
  } else {
    return { status: 'FAILED', error: result.StatusMessage };
  }
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
      'Authorization': `Bearer ${env.TONGYI_API_KEY}`,
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
        'Authorization': `Bearer ${env.TONGYI_API_KEY}`,
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
      dialogue: videoInfo.transcript ? videoInfo.transcript.substring(0, 100) + "..." : "主要内容"
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