/**
 * Cloudflare Worker - 使用阿里云服务（ASR + 通义千问）
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
    
    try {
      // 测试端点
      if (url.pathname === '/api/test') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Worker正常运行',
          timestamp: new Date().toISOString(),
          aliyun: {
            asrConfigured: !!(env.ALIYUN_ACCESS_KEY_ID && env.ALIYUN_ACCESS_KEY_SECRET),
            qwenConfigured: !!(env.QWEN_API_KEY)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 使用阿里云处理音频转文字和脚本生成
      if (url.pathname === '/api/process-with-aliyun') {
        console.log('收到阿里云处理请求');
        const body = await request.json();
        const douyinUrl = body.douyinUrl;
        console.log('抖音链接:', douyinUrl);
        
        if (!douyinUrl) {
          return new Response(JSON.stringify({
            error: 'Missing douyinUrl parameter'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 检查阿里云配置
        if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET || !env.QWEN_API_KEY) {
          return new Response(JSON.stringify({
            error: '阿里云服务未配置，请联系管理员'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 步骤1：调用 TikHub 获取视频信息
        console.log('步骤1: 调用 TikHub API...');
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
        console.log('TikHub 响应状态:', tikHubData.code);
        
        if (tikHubData.code !== 200) {
          console.error('TikHub API 失败:', tikHubData);
          return new Response(JSON.stringify({
            success: false,
            step: 'TikHub',
            error: tikHubData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 步骤2：提取音频URL
        console.log('步骤2: 提取音频URL...');
        const aweme = tikHubData.data?.aweme_detail;
        let audioUrl = null;
        
        if (aweme?.music?.play_url?.url_list) {
          for (const url of aweme.music.play_url.url_list) {
            if (url && url.includes('.mp3')) {
              audioUrl = url;
              break;
            }
          }
        }
        
        if (!audioUrl) {
          console.error('未找到音频文件');
          return new Response(JSON.stringify({
            success: false,
            error: '无法找到音频文件'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('找到音频URL:', audioUrl);
        
        // 步骤3：使用阿里云 ASR 语音识别
        console.log('步骤3: 调用阿里云 ASR...');
        const taskId = await submitASRTask(audioUrl, env);
        console.log('ASR 任务ID:', taskId);
        
        // 步骤4：等待 ASR 结果
        console.log('步骤4: 等待 ASR 结果...');
        const transcript = await waitForASRResult(taskId, env);
        console.log('语音识别完成，长度:', transcript.length);
        
        // 步骤5：使用通义千问生成分镜脚本
        console.log('步骤5: 使用通义千问生成脚本...');
        const script = await generateScriptWithQwen({
          title: aweme?.desc || '无标题',
          author: aweme?.author?.nickname || '未知作者',
          transcript: transcript
        }, env);
        
        return new Response(JSON.stringify({
          success: true,
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID',
            musicTitle: aweme?.music?.title || '未知音乐'
          },
          audioUrl: audioUrl,
          transcript: transcript,
          script: script,
          message: '处理完成！'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error('Worker 错误:', error.message);
      console.error('错误堆栈:', error.stack);
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

// 提交阿里云 ASR 任务
async function submitASRTask(audioUrl, env) {
  // 阿里云 ASR API 端点
  const endpoint = 'https://nls-gateway.cn-shanghai.aliyuncs.com/rest/v1/recognition/async';
  
  // 生成签名（简化版，实际使用需要完整的签名算法）
  const timestamp = new Date().toISOString();
  
  const requestBody = {
    app_key: env.ALIYUN_APP_KEY || 'default',
    file_link: audioUrl,
    version: '2.0',
    enable_words: false,
    enable_sample_rate_adaptive: true,
    enable_unify_post: true
  };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NLS-Token': env.ALIYUN_NLS_TOKEN || await getNLSToken(env),
      'Accept': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ASR 提交失败: ${error}`);
  }
  
  const data = await response.json();
  return data.task_id;
}

// 等待 ASR 结果
async function waitForASRResult(taskId, env) {
  const endpoint = `https://nls-gateway.cn-shanghai.aliyuncs.com/rest/v1/recognition/query`;
  let attempts = 0;
  const maxAttempts = 30; // 最多等待 30 秒
  
  while (attempts < maxAttempts) {
    const response = await fetch(`${endpoint}?task_id=${taskId}`, {
      method: 'GET',
      headers: {
        'X-NLS-Token': env.ALIYUN_NLS_TOKEN || await getNLSToken(env),
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('ASR 查询失败');
    }
    
    const data = await response.json();
    
    if (data.status === 'SUCCESS') {
      return data.result || '无法识别音频内容';
    } else if (data.status === 'FAILED') {
      throw new Error('ASR 处理失败: ' + data.error_message);
    }
    
    // 等待 1 秒后重试
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }
  
  throw new Error('ASR 处理超时');
}

// 获取 NLS Token（需要实现）
async function getNLSToken(env) {
  // 这里应该实现获取 NLS Token 的逻辑
  // 暂时返回模拟值
  return 'mock-nls-token';
}

// 使用通义千问生成分镜脚本
async function generateScriptWithQwen(videoData, env) {
  const endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
  
  const prompt = `你是一位专业的视频分镜脚本编剧。请根据以下信息生成一个详细的分镜脚本：

视频标题：${videoData.title}
作者：${videoData.author}
识别的对话内容：
${videoData.transcript}

请生成一个专业的分镜脚本，包含以下要素：
1. 将视频分成4-6个场景
2. 每个场景包含：场景名称、时间段、画面描述、镜头类型、对话/旁白
3. 镜头类型要专业（如：特写、中景、远景、推拉摇移等）
4. 画面描述要具体生动

请以JSON格式返回，格式如下：
[
  {
    "scene": "场景1：开场",
    "time": "0:00-0:05",
    "visual": "画面描述",
    "camera": "镜头类型和运动",
    "dialogue": "对话或旁白内容"
  }
]`;
  
  try {
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
            role: 'system',
            content: '你是一位专业的视频分镜脚本编剧，擅长将对话内容转换为详细的分镜脚本。'
          }, {
            role: 'user',
            content: prompt
          }]
        },
        parameters: {
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.95
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('通义千问调用失败:', error);
      throw new Error('脚本生成失败');
    }
    
    const data = await response.json();
    const content = data.output?.text || '';
    
    // 尝试解析 JSON
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const script = JSON.parse(jsonMatch[0]);
        return Array.isArray(script) ? script : [script];
      }
    } catch (e) {
      console.error('JSON 解析失败，使用默认格式');
    }
    
    // 如果解析失败，返回默认格式
    return generateDefaultScript(videoData);
    
  } catch (error) {
    console.error('调用通义千问失败:', error);
    return generateDefaultScript(videoData);
  }
}

// 生成默认脚本（备用）
function generateDefaultScript(videoData) {
  const lines = videoData.transcript.split('\n').filter(line => line.trim());
  const scenes = [];
  
  let currentTime = 0;
  const timePerLine = 5;
  
  lines.forEach((line, index) => {
    const startTime = currentTime;
    const endTime = currentTime + timePerLine;
    
    scenes.push({
      scene: `场景${index + 1}`,
      time: `0:${String(startTime).padStart(2, '0')}-0:${String(endTime).padStart(2, '0')}`,
      visual: index === 0 ? '开场画面，展示主要人物' : '人物对话场景',
      camera: index % 2 === 0 ? '中景，缓慢推进' : '特写，聚焦说话人',
      dialogue: line
    });
    
    currentTime = endTime;
  });
  
  return scenes;
}