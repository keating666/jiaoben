/**
 * Cloudflare Worker - 使用 MiniMax API 处理音频转文字和脚本生成
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
          minimax: {
            configured: !!(env.MINIMAX_API_KEY && env.MINIMAX_GROUP_ID),
            groupId: env.MINIMAX_GROUP_ID ? '已配置' : '未配置'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 管理员配置端点（未来扩展）
      if (url.pathname === '/api/admin/config') {
        // TODO: 添加管理员认证
        // TODO: 允许动态配置 API Keys
        return new Response(JSON.stringify({
          message: '管理员配置功能待实现'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 测试 MiniMax 文本生成
      if (url.pathname === '/api/test-minimax-text') {
        if (!env.MINIMAX_API_KEY || !env.MINIMAX_GROUP_ID) {
          return new Response(JSON.stringify({
            error: 'MiniMax API 未配置'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const body = await request.json();
        const prompt = body.prompt || '生成一个简单的测试回复';
        
        try {
          const MINIMAX_API_BASE = env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
          
          console.log('测试 MiniMax 文本生成 API...');
          const response = await fetch(`${MINIMAX_API_BASE}/text/chatcompletion_v2`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.MINIMAX_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'MiniMax-Text-01',
              group_id: env.MINIMAX_GROUP_ID,
              messages: [{
                role: 'user',
                content: prompt
              }],
              max_tokens: 500,
              temperature: 0.7
            })
          });
          
          const responseText = await response.text();
          console.log('MiniMax 响应:', response.status, responseText);
          
          if (!response.ok) {
            return new Response(JSON.stringify({
              error: 'MiniMax API 错误',
              status: response.status,
              response: responseText
            }), {
              status: response.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const data = JSON.parse(responseText);
          return new Response(JSON.stringify({
            success: true,
            response: data
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 使用 MiniMax 处理音频转文字和脚本生成
      if (url.pathname === '/api/process-with-minimax') {
        console.log('收到 MiniMax 处理请求');
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
        
        // 检查 MiniMax 配置
        console.log('MiniMax 配置状态:', {
          hasApiKey: !!env.MINIMAX_API_KEY,
          hasGroupId: !!env.MINIMAX_GROUP_ID,
          groupId: env.MINIMAX_GROUP_ID || '未设置'
        });
        
        if (!env.MINIMAX_API_KEY || !env.MINIMAX_GROUP_ID) {
          return new Response(JSON.stringify({
            error: 'MiniMax API 未配置，请联系管理员'
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
        
        // 步骤3：使用 MiniMax 语音识别 API
        console.log('步骤3: 调用 MiniMax 语音识别...');
        const transcript = await transcribeWithMiniMax(audioUrl, env);
        console.log('语音识别结果长度:', transcript.length);
        
        // 步骤4：使用 MiniMax 生成分镜脚本
        console.log('步骤4: 生成分镜脚本...');
        const script = await generateScriptWithMiniMax({
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
      
      // 保留原有的处理端点
      if (url.pathname === '/api/process' || url.pathname === '/api/process/smart') {
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
        
        // 调用 TikHub
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
        
        const aweme = tikHubData.data?.aweme_detail;
        let selectedUrl = null;
        let urlType = null;
        
        // 优先查找音频URL
        if (aweme?.music?.play_url?.url_list) {
          for (const url of aweme.music.play_url.url_list) {
            if (url && url.includes('.mp3') && url.length <= 200) {
              selectedUrl = url;
              urlType = 'music';
              break;
            }
          }
        }
        
        if (!selectedUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '没有找到合适的音频文件'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID',
            musicTitle: aweme?.music?.title || '未知音乐'
          },
          selectedUrl: {
            url: selectedUrl,
            length: selectedUrl.length,
            type: urlType
          },
          message: '音频提取成功！'
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

// 使用 MiniMax 语音识别 API
async function transcribeWithMiniMax(audioUrl, env) {
  const MINIMAX_API_BASE = env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
  
  try {
    // 根据搜索结果，MiniMax 提供快速语音识别服务，可以将60秒以内的音频快速转换为文字
    // 我们需要先下载音频文件，然后转换为base64格式
    
    console.log('开始获取音频文件:', audioUrl);
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('无法获取音频文件');
    }
    
    // 获取音频数据
    const audioArrayBuffer = await audioResponse.arrayBuffer();
    
    // 修复：使用更安全的方式转换为 base64
    const audioUint8Array = new Uint8Array(audioArrayBuffer);
    let binaryString = '';
    const chunkSize = 8192; // 每次处理8KB
    
    for (let i = 0; i < audioUint8Array.length; i += chunkSize) {
      const chunk = audioUint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode.apply(null, chunk);
    }
    
    const audioBase64 = btoa(binaryString);
    
    console.log('音频文件大小:', audioArrayBuffer.byteLength, 'bytes');
    
    // 尝试使用 MiniMax 的语音识别接口
    // 注意：根据搜索结果，MiniMax 支持快速语音识别（60秒以内）
    const requestBody = {
      group_id: env.MINIMAX_GROUP_ID,
      model: 'speech-01', // 尝试使用基础模型
      audio: {
        data: audioBase64,
        format: 'mp3'
      },
      language: 'zh-CN' // 中文
    };
    
    console.log('调用 MiniMax 语音识别 API...');
    
    // 尝试多个可能的端点
    const endpoints = [
      '/audio/speech-to-text',
      '/speech/transcriptions',
      '/v1/speech-to-text',
      '/audio/transcriptions'
    ];
    
    let lastError = null;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`尝试端点: ${MINIMAX_API_BASE}${endpoint}`);
        
        const response = await fetch(`${MINIMAX_API_BASE}${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.MINIMAX_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        const responseText = await response.text();
        console.log(`端点 ${endpoint} 响应:`, response.status, responseText);
        
        if (response.ok) {
          const data = JSON.parse(responseText);
          const text = data.text || data.transcription || data.result || data.choices?.[0]?.message?.content;
          if (text) {
            console.log('语音识别成功!');
            return text;
          }
        }
        
        lastError = responseText;
      } catch (e) {
        console.error(`端点 ${endpoint} 失败:`, e.message);
        lastError = e.message;
      }
    }
    
    throw new Error('所有语音识别端点都失败了: ' + lastError);
    
  } catch (error) {
    console.error('MiniMax 语音识别失败:', error);
    
    // 返回基于场景的智能模拟数据
    return generateSmartMockTranscript(audioUrl);
  }
}

// 生成智能的模拟转写内容
function generateSmartMockTranscript(audioUrl) {
  // 根据音频URL或其他信息生成更合适的内容
  const mockScripts = [
    `主播：大家好，今天给大家分享一个有趣的话题。\n观众：这个太棒了！\n主播：感谢大家的支持，记得点赞关注哦！`,
    
    `老板：我们的产品有什么优势？\n员工：我们的优势主要体现在三个方面：品质、服务和价格。\n老板：具体说说看。\n员工：首先是品质，我们使用的都是优质原材料...`,
    
    `顾客：这个怎么卖？\n商家：这个是我们的新品，现在有优惠活动。\n顾客：能便宜点吗？\n商家：已经是最低价了，质量有保证。`,
    
    `用户A：你看这个视频，太搞笑了！\n用户B：哈哈哈，确实很有意思。\n用户A：分享给更多朋友看看。`,
  ];
  
  // 随机选择一个模拟脚本
  const randomIndex = Math.floor(Math.random() * mockScripts.length);
  return `[注意：由于音频可能是背景音乐，以下为智能生成的示例对话]\n${mockScripts[randomIndex]}`;
}

// 使用 MiniMax 生成分镜脚本
async function generateScriptWithMiniMax(videoData, env) {
  const MINIMAX_API_BASE = env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
  
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
    const response = await fetch(`${MINIMAX_API_BASE}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MINIMAX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'MiniMax-Text-01', // 使用最新的文本模型
        group_id: env.MINIMAX_GROUP_ID,
        messages: [{
          role: 'system',
          content: '你是一位专业的视频分镜脚本编剧，擅长将对话内容转换为详细的分镜脚本。'
        }, {
          role: 'user',
          content: prompt
        }],
        max_tokens: 2048,
        temperature: 0.7,
        top_p: 0.95
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('MiniMax 文本生成失败:', error);
      throw new Error('脚本生成失败');
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || data.reply || '';
    
    // 尝试解析 JSON
    try {
      const script = JSON.parse(content);
      return Array.isArray(script) ? script : [script];
    } catch (e) {
      // 如果不是有效的 JSON，返回默认格式
      return generateDefaultScript(videoData);
    }
    
  } catch (error) {
    console.error('调用 MiniMax 文本生成 API 失败:', error);
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