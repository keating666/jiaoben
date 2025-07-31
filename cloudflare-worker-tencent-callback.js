/**
 * Cloudflare Worker - 腾讯云ASR回调版本
 * 使用回调方式获取识别结果，避免超时问题
 */

import crypto from 'node:crypto';

export default {
  async fetch(request, env, ctx) {
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
          message: 'Worker正常运行 - 腾讯云ASR回调版本',
          timestamp: new Date().toISOString(),
          features: {
            linkCleaning: true,
            tencentASR: !!(env.TENCENT_SECRET_ID && env.TENCENT_SECRET_KEY),
            qianwen: !!env.TONGYI_API_KEY,
            tikhub: !!env.TIKHUB_API_TOKEN,
            kvStorage: !!env.ASR_RESULTS
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 回调接收端点
      if (path === '/api/asr-callback' || path === '/api/asr-callback/') {
        if (request.method !== 'POST') {
          return new Response('Method not allowed', { status: 405 });
        }
        
        const body = await request.json();
        console.log('收到ASR回调:', JSON.stringify(body));
        
        // 提取任务ID和结果
        const taskId = body.TaskId;
        const status = body.StatusText;
        const result = body.Result;
        
        if (taskId && env.ASR_RESULTS) {
          // 存储结果到KV
          const data = {
            status: status,
            result: result,
            timestamp: Date.now()
          };
          
          await env.ASR_RESULTS.put(`task_${taskId}`, JSON.stringify(data), {
            expirationTtl: 3600 // 1小时后过期
          });
          
          console.log(`ASR结果已存储: task_${taskId}`);
        }
        
        return new Response('OK', { status: 200 });
      }
      
      // 查询结果端点
      if (path === '/api/query-result' || path === '/api/query-result/') {
        const { searchParams } = url;
        const taskId = searchParams.get('taskId');
        
        if (!taskId) {
          return new Response(JSON.stringify({
            error: '请提供taskId'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (!env.ASR_RESULTS) {
          return new Response(JSON.stringify({
            error: 'KV存储未配置'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const result = await env.ASR_RESULTS.get(`task_${taskId}`);
        
        if (result) {
          const data = JSON.parse(result);
          return new Response(JSON.stringify({
            success: true,
            ...data
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            status: 'PROCESSING',
            message: '结果还未准备好'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 主处理端点 - 快速返回
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
        
        // 步骤3：创建腾讯云ASR任务（带回调）
        console.log('步骤3: 创建腾讯云ASR任务（回调模式）...');
        
        // 生成回调URL
        const callbackUrl = `https://${url.hostname}/api/asr-callback`;
        console.log('回调URL:', callbackUrl);
        
        const taskId = await createTencentASRTask(audioUrl, callbackUrl, env);
        
        if (!taskId) {
          return new Response(JSON.stringify({
            success: false,
            error: '创建ASR任务失败'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('ASR任务创建成功，TaskId:', taskId);
        
        // 快速返回响应，不等待结果
        return new Response(JSON.stringify({
          success: true,
          taskId: taskId,
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
          message: 'ASR任务已提交，请使用taskId查询结果',
          queryUrl: `https://${url.hostname}/api/query-result?taskId=${taskId}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      if (path === '/' || path === '') {
        return new Response('Jiaoben API Worker - 腾讯云ASR回调版本', {
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

// 创建腾讯云ASR任务（带回调）
async function createTencentASRTask(audioUrl, callbackUrl, env) {
  const endpoint = 'asr.tencentcloudapi.com';
  const service = 'asr';
  const action = 'CreateRecTask';
  const version = '2019-06-14';
  const region = 'ap-shanghai';
  
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().substr(0, 10);
  
  // 请求参数 - 添加回调URL
  const params = {
    EngineModelType: '16k_zh', // 16k中文普通话通用
    ChannelNum: 1,
    ResTextFormat: 0,
    SourceType: 0, // URL方式
    Url: audioUrl,
    CallbackUrl: callbackUrl // 添加回调URL
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
  console.log('创建ASR任务 - 回调URL:', callbackUrl);
  
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