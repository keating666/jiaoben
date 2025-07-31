/**
 * Cloudflare Worker - ASR调试版本
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
      // ASR调试端点
      if (path === '/api/debug-asr' || path === '/api/debug-asr/') {
        const debugLog = [];
        
        debugLog.push('=== ASR 调试信息 ===');
        debugLog.push(`时间: ${new Date().toISOString()}`);
        
        // 1. 检查环境变量
        debugLog.push('\n1. 环境变量检查:');
        debugLog.push(`- ALIYUN_ACCESS_KEY_ID: ${env.ALIYUN_ACCESS_KEY_ID ? '已配置' : '未配置'}`);
        debugLog.push(`- ALIYUN_ACCESS_KEY_SECRET: ${env.ALIYUN_ACCESS_KEY_SECRET ? '已配置' : '未配置'}`);
        debugLog.push(`- ALIYUN_APP_KEY: ${env.ALIYUN_APP_KEY ? '已配置' : '未配置'}`);
        
        if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET || !env.ALIYUN_APP_KEY) {
          debugLog.push('\n❌ 环境变量不完整！');
          return new Response(JSON.stringify({
            success: false,
            debug: debugLog.join('\n')
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 2. 测试Token获取
        debugLog.push('\n2. 测试Token获取:');
        try {
          const token = await getAliyunToken(env);
          debugLog.push(`✅ Token获取成功: ${token.substring(0, 20)}...`);
        } catch (error) {
          debugLog.push(`❌ Token获取失败: ${error.message}`);
          debugLog.push(`错误堆栈: ${error.stack}`);
          return new Response(JSON.stringify({
            success: false,
            debug: debugLog.join('\n')
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 3. 测试ASR调用
        debugLog.push('\n3. 测试ASR调用:');
        const testAudioUrl = 'https://sf6-cdn-tos.douyinstatic.com/obj/ies-music/7531294223631846198.mp3';
        debugLog.push(`测试音频: ${testAudioUrl}`);
        
        try {
          const transcript = await transcribeWithAliyunASR(testAudioUrl, env, debugLog);
          debugLog.push(`✅ ASR成功: ${transcript.substring(0, 100)}...`);
        } catch (error) {
          debugLog.push(`❌ ASR失败: ${error.message}`);
          debugLog.push(`错误详情: ${JSON.stringify(error, null, 2)}`);
        }
        
        return new Response(JSON.stringify({
          success: true,
          debug: debugLog.join('\n')
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 其他端点...
      return new Response('Debug ASR Worker', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

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
  
  const response = await fetch('https://nlsmeta.cn-shanghai.aliyuncs.com/pop/2019-02-28/tokens', {
    method: 'POST',
    headers: {
      'Accept': accept,
      'Content-Type': contentType,
      'Date': date,
      'Authorization': authorization
    },
    body: JSON.stringify({
      version: '2019-02-28',
      appkey: env.ALIYUN_APP_KEY,
      token_version: '1.0'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`获取Token失败: ${error}`);
  }
  
  const data = await response.json();
  return data.Token?.Id;
}

// 使用阿里云ASR进行语音识别（带调试日志）
async function transcribeWithAliyunASR(audioUrl, env, debugLog = []) {
  // 获取 Token
  const token = await getAliyunToken(env);
  debugLog.push(`获取到ASR Token: ${token.substring(0, 20)}...`);
  
  // 提交ASR任务
  const taskBody = {
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
  };
  
  debugLog.push(`提交ASR任务: ${JSON.stringify(taskBody, null, 2)}`);
  
  const taskResponse = await fetch('https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr', {
    method: 'POST',
    headers: {
      'X-NLS-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskBody)
  });
  
  const taskText = await taskResponse.text();
  debugLog.push(`ASR任务响应状态: ${taskResponse.status}`);
  debugLog.push(`ASR任务响应: ${taskText}`);
  
  if (!taskResponse.ok) {
    throw new Error(`ASR提交失败: ${taskText}`);
  }
  
  let taskData;
  try {
    taskData = JSON.parse(taskText);
  } catch (e) {
    throw new Error(`ASR响应解析失败: ${taskText}`);
  }
  
  const taskId = taskData.task_id;
  debugLog.push(`ASR任务ID: ${taskId}`);
  
  // 等待结果
  let attempts = 0;
  const maxAttempts = 30; // 最多等待30秒
  
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
    
    const resultText = await resultResponse.text();
    debugLog.push(`第${attempts + 1}次查询结果: ${resultText.substring(0, 200)}...`);
    
    if (resultResponse.ok) {
      let resultData;
      try {
        resultData = JSON.parse(resultText);
      } catch (e) {
        debugLog.push(`结果解析失败: ${resultText}`);
        continue;
      }
      
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