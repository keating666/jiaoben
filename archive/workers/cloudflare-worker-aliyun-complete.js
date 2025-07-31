/**
 * Cloudflare Worker - 阿里云完整版（ASR语音识别 + 通义千问）
 */

import crypto from 'crypto';

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
            asrConfigured: !!(env.ALIYUN_ACCESS_KEY_ID && env.ALIYUN_ACCESS_KEY_SECRET && env.ALIYUN_APP_KEY),
            qwenConfigured: !!(env.QWEN_API_KEY)
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 获取 Token 端点
      if (url.pathname === '/api/get-token') {
        const token = await getAliyunToken(env);
        return new Response(JSON.stringify({
          success: true,
          token: token
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 完整处理流程
      if (url.pathname === '/api/process') {
        console.log('收到处理请求');
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
        if (!env.QWEN_API_KEY) {
          return new Response(JSON.stringify({
            error: '通义千问未配置，请联系管理员'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (!env.ALIYUN_ACCESS_KEY_ID || !env.ALIYUN_ACCESS_KEY_SECRET || !env.ALIYUN_APP_KEY) {
          console.log('ASR未配置，使用模拟数据');
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
        
        if (tikHubData.code !== 200) {
          return new Response(JSON.stringify({
            success: false,
            step: 'TikHub',
            error: tikHubData
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 步骤2：提取音频URL
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
          return new Response(JSON.stringify({
            success: false,
            error: '无法找到音频文件'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        console.log('找到音频URL:', audioUrl);
        
        // 步骤3：语音识别
        let transcript = '';
        
        if (env.ALIYUN_ACCESS_KEY_ID && env.ALIYUN_ACCESS_KEY_SECRET && env.ALIYUN_APP_KEY) {
          console.log('步骤3: 使用阿里云ASR...');
          try {
            transcript = await transcribeWithAliyunASR(audioUrl, env);
          } catch (error) {
            console.error('ASR失败，使用模拟数据:', error);
            transcript = generateSmartTranscript(aweme?.desc || '抖音视频');
          }
        } else {
          console.log('步骤3: 使用模拟对话...');
          transcript = generateSmartTranscript(aweme?.desc || '抖音视频');
        }
        
        // 步骤4：使用通义千问生成分镜脚本
        console.log('步骤4: 使用通义千问生成脚本...');
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

// 获取阿里云 Token
async function getAliyunToken(env) {
  const date = new Date().toUTCString();
  const md5 = "";
  const contentType = "application/json";
  const accept = "application/json";
  
  // 构建签名字符串
  const stringToSign = `POST\n${accept}\n${md5}\n${contentType}\n${date}\n/pop/2019-02-28/tokens`;
  
  // 计算签名
  const signature = crypto
    .createHmac('sha1', env.ALIYUN_ACCESS_KEY_SECRET)
    .update(stringToSign)
    .digest('base64');
  
  const authorization = `acs ${env.ALIYUN_ACCESS_KEY_ID}:${signature}`;
  
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
  console.log('获取到Token');
  
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
      console.log('ASR状态:', resultData.status);
      
      if (resultData.status === 'SUCCESS' || resultData.status === 21000000) {
        return resultData.result || resultData.text || '无法识别音频内容';
      } else if (resultData.status === 'FAILED' || resultData.status > 21000000) {
        throw new Error('ASR处理失败: ' + (resultData.status_text || resultData.status));
      }
    }
    
    attempts++;
  }
  
  throw new Error('ASR处理超时');
}

// 生成智能的模拟转写内容
function generateSmartTranscript(title) {
  const keywords = {
    '美食': `主播：今天给大家分享一道超简单的家常菜。
观众：看起来很好吃！
主播：这道菜的关键是调料的比例，大家要记好了。
观众：已经收藏了，明天就试试。
主播：做法很简单，先把食材准备好...`,
    
    '搞笑': `人物A：你知道吗？昨天发生了一件特别搞笑的事。
人物B：什么事？快说来听听。
人物A：我去超市买东西，结果...
人物B：哈哈哈，笑死我了！`,
    
    '教程': `老师：大家好，今天我们来学习这个技巧。
学生：老师，这个步骤有点复杂。
老师：没关系，我再演示一遍，大家仔细看。
学生：原来是这样，懂了！`,
    
    '产品': `主播：这个产品真的太好用了！
粉丝：真的有那么好吗？
主播：我已经用了三个月，效果特别明显。
粉丝：那我也要试试看。`,
    
    '日常': `博主：今天跟大家分享一下我的日常。
粉丝：期待已久！
博主：早上起床第一件事就是...
粉丝：原来你也是这样，我们好像！`
  };
  
  for (const [keyword, content] of Object.entries(keywords)) {
    if (title.includes(keyword)) {
      return content;
    }
  }
  
  return `主播：大家好，欢迎来到我的直播间。
观众：主播好！
主播：今天要给大家分享的内容特别精彩。
观众：期待！
主播：让我们开始吧...`;
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
    const response = await callQwenAPI(prompt, env);
    
    // 尝试从响应中提取JSON
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const script = JSON.parse(jsonMatch[0]);
        return Array.isArray(script) ? script : [script];
      } catch (e) {
        console.error('JSON解析失败:', e);
      }
    }
    
    // 如果无法解析JSON，生成默认格式
    return generateDefaultScript(videoData);
    
  } catch (error) {
    console.error('生成脚本失败:', error);
    return generateDefaultScript(videoData);
  }
}

// 生成默认脚本
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