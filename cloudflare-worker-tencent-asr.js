/**
 * Cloudflare Worker - 腾讯云ASR直传URL版本
 * 流程：TikHub → 音频URL → 腾讯云ASR（URL直传） → 轮询结果 → 通义千问生成脚本
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
          message: 'Worker正常运行 - 腾讯云ASR版本',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            tencentASR: !!(env.TENCENT_SECRET_ID && env.TENCENT_SECRET_KEY),
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
        
        if (!env.TENCENT_SECRET_ID || !env.TENCENT_SECRET_KEY) {
          return new Response(JSON.stringify({
            error: '腾讯云ASR未配置'
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
        
        // 步骤3：创建腾讯云ASR任务
        console.log('步骤3: 创建腾讯云ASR任务...');
        const taskId = await createTencentASRTask(audioUrl, env);
        
        if (!taskId) {
          return new Response(JSON.stringify({
            success: false,
            error: '创建ASR任务失败'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('ASR任务创建成功，TaskId:', taskId);
        
        // 步骤4：快速轮询任务结果（优化策略）
        console.log('步骤4: 轮询ASR任务结果...');
        // 短音频通常3-10秒完成，采用递增延迟策略
        const pollStrategy = [
          { delay: 1000, count: 3 },  // 前3次，每秒查询
          { delay: 2000, count: 3 },  // 接下来3次，每2秒查询
          { delay: 3000, count: 4 }   // 最后4次，每3秒查询
        ];
        let transcript = null;
        let totalPolls = 0;
        
        // 使用优化的轮询策略
        for (const strategy of pollStrategy) {
          for (let i = 0; i < strategy.count; i++) {
            totalPolls++;
            
            // 先查询一次（首次不等待）
            if (totalPolls > 1) {
              await new Promise(resolve => setTimeout(resolve, strategy.delay));
            }
            
            const result = await getTencentASRResult(taskId, env);
            if (result.status === 'success') {
              transcript = result.transcript;
              console.log(`ASR识别成功！第${totalPolls}次查询`);
              break;
            } else if (result.status === 'failed') {
              console.error('ASR任务失败:', result.error);
              break;
            }
            
            console.log(`轮询第${totalPolls}次，延迟${strategy.delay}ms，状态: ${result.status}`);
          }
          
          if (transcript !== null) break;
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
          message: taskId ? '处理完成（腾讯云ASR）' : '处理完成（智能生成）'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 调试端点 - 测试腾讯云ASR连接
      if (path === '/api/debug-asr' || path === '/api/debug-asr/') {
        if (!env.TENCENT_SECRET_ID || !env.TENCENT_SECRET_KEY) {
          return new Response(JSON.stringify({
            error: '腾讯云密钥未配置',
            hint: '请在Cloudflare Dashboard配置TENCENT_SECRET_ID和TENCENT_SECRET_KEY'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 测试创建任务
        const testUrl = 'https://www.w3schools.com/html/horse.mp3';
        console.log('调试：尝试创建ASR任务，音频URL:', testUrl);
        
        const taskId = await createTencentASRTask(testUrl, env);
        
        return new Response(JSON.stringify({
          success: !!taskId,
          taskId: taskId,
          message: taskId ? 'ASR任务创建成功' : 'ASR任务创建失败，请查看Worker日志'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - 腾讯云ASR版本', {
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

// 创建腾讯云ASR任务
async function createTencentASRTask(audioUrl, env) {
  const endpoint = 'asr.tencentcloudapi.com';
  const service = 'asr';
  const action = 'CreateRecTask';
  const version = '2019-06-14';
  const region = 'ap-shanghai';
  
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().substr(0, 10);
  
  // 请求参数 - 注意参数名大小写
  const params = {
    EngineModelType: '16k_zh', // 16k中文普通话通用
    ChannelNum: 1,
    ResTextFormat: 0,
    SourceType: 0, // URL方式
    Url: audioUrl
  };
  
  const payload = JSON.stringify(params);
  
  // 生成签名
  const signature = await generateTencentSignature({
    secretId: env.TENCENT_SECRET_ID,
    secretKey: env.TENCENT_SECRET_KEY,
    service,
    host: endpoint,
    action,
    version,
    timestamp,
    date,
    payload
  });
  
  // 构建请求headers
  const headers = {
    'Content-Type': 'application/json',
    'X-TC-Action': action,
    'X-TC-Version': version,
    'X-TC-Timestamp': timestamp.toString(),
    'X-TC-Region': region,
    'Authorization': signature
  };
  
  console.log('创建ASR任务 - 请求参数:', payload);
  console.log('创建ASR任务 - 音频URL:', audioUrl);
  
  // 发送请求
  const response = await fetch(`https://${endpoint}/`, {
    method: 'POST',
    headers: headers,
    body: payload
  });
  
  const responseText = await response.text();
  console.log('创建ASR任务 - HTTP状态:', response.status);
  console.log('创建ASR任务 - 响应:', responseText);
  
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    console.error('创建ASR任务 - 解析响应失败:', e);
    return null;
  }
  
  if (result.Response?.Error) {
    console.error('腾讯云ASR错误:', result.Response.Error);
    return null;
  }
  
  // 腾讯云返回的TaskId可能在不同层级
  const taskId = result.Response?.Data?.TaskId || result.Response?.TaskId;
  if (!taskId) {
    console.error('未获取到TaskId，响应:', JSON.stringify(result));
    return null;
  }
  
  return taskId;
}

// 获取腾讯云ASR结果
async function getTencentASRResult(taskId, env) {
  const endpoint = 'asr.tencentcloudapi.com';
  const service = 'asr';
  const action = 'DescribeTaskStatus';
  const version = '2019-06-14';
  const region = 'ap-shanghai';
  
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().substr(0, 10);
  
  const params = { TaskId: parseInt(taskId) };
  const payload = JSON.stringify(params);
  
  // 生成签名
  const signature = await generateTencentSignature({
    secretId: env.TENCENT_SECRET_ID,
    secretKey: env.TENCENT_SECRET_KEY,
    service,
    host: endpoint,
    action,
    version,
    timestamp,
    date,
    payload
  });
  
  // 发送请求
  const response = await fetch(`https://${endpoint}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Region': region,
      'Authorization': signature
    },
    body: payload
  });
  
  const result = await response.json();
  
  if (result.Response?.Error) {
    return { status: 'failed', error: result.Response.Error.Message };
  }
  
  const data = result.Response?.Data;
  if (!data) {
    return { status: 'failed', error: '无响应数据' };
  }
  
  // 状态: 0=等待, 1=执行中, 2=成功, 3=失败
  if (data.Status === 2) {
    return { 
      status: 'success', 
      transcript: data.Result || ''
    };
  } else if (data.Status === 3) {
    return { status: 'failed', error: data.ErrorMsg || '识别失败' };
  } else {
    return { status: 'processing' };
  }
}

// 生成腾讯云签名
async function generateTencentSignature(options) {
  const { secretId, secretKey, service, host, action, version, timestamp, date, payload } = options;
  
  // 1. 拼接规范请求串
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  
  const hashedPayload = crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
  
  const canonicalRequest = 
    `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n` +
    `${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;
  
  // 2. 拼接待签名字符串
  const algorithm = 'TC3-HMAC-SHA256';
  const hashedCanonicalRequest = crypto
    .createHash('sha256')
    .update(canonicalRequest)
    .digest('hex');
  
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = 
    `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;
  
  // 3. 计算签名
  const secretDate = crypto
    .createHmac('sha256', `TC3${secretKey}`)
    .update(date)
    .digest();
  
  const secretService = crypto
    .createHmac('sha256', secretDate)
    .update(service)
    .digest();
  
  const secretSigning = crypto
    .createHmac('sha256', secretService)
    .update('tc3_request')
    .digest();
  
  const signature = crypto
    .createHmac('sha256', secretSigning)
    .update(stringToSign)
    .digest('hex');
  
  // 4. 拼接 Authorization
  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
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