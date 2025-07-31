/**
 * Cloudflare Worker - 使用大模型直接处理音频转文字和脚本生成
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
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 新增：直接处理音频转文字和脚本生成
      if (url.pathname === '/api/process-with-ai') {
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
        
        // 步骤1：调用 TikHub 获取视频信息
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
        
        // 步骤3：使用 AI 处理（这里需要集成实际的 AI API）
        // 可以使用 OpenAI Whisper API 或其他语音识别服务
        const aiPrompt = `
请分析这个抖音视频并生成分镜脚本：

视频标题：${aweme?.desc || '无标题'}
作者：${aweme?.author?.nickname || '未知'}
音频URL：${audioUrl}

请完成以下任务：
1. 描述视频可能的内容（基于标题）
2. 生成一个30秒左右的分镜脚本
3. 包含场景描述、镜头语言、对话内容

输出格式：
场景X：[场景描述]
时间：[起始时间-结束时间]
画面：[画面内容描述]
镜头：[镜头类型和运动]
对话/旁白：[对话内容]
`;

        // 这里应该调用实际的 AI API
        // 暂时返回模拟数据
        const mockTranscript = generateMockTranscript(aweme?.desc);
        const mockScript = generateMockScript(aweme?.desc, mockTranscript);
        
        return new Response(JSON.stringify({
          success: true,
          videoInfo: {
            title: aweme?.desc || '无标题',
            author: aweme?.author?.nickname || '未知作者',
            videoId: aweme?.aweme_id || '未知ID',
            musicTitle: aweme?.music?.title || '未知音乐'
          },
          audioUrl: audioUrl,
          transcript: mockTranscript,
          script: mockScript,
          message: '处理完成！'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 原有的处理流程保持不变
      if (url.pathname === '/api/process' || url.pathname === '/api/process/smart') {
        // ... 原有代码 ...
      }
      
      return new Response('Not Found', { status: 404 });
      
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
};

// 模拟生成文字内容
function generateMockTranscript(title) {
  const templates = {
    '价格': `老板：相同的产品为什么价格差距这么大？
员工：老板，这主要是因为原材料和工艺的差异。
老板：具体说说看。
员工：比如这两个看起来相似的产品，一个用的是高端材料，另一个用的是普通材料。`,
    
    '搞笑': `人物A：你知道吗？我今天遇到一件特别搞笑的事。
人物B：什么事？快说来听听。
人物A：我早上出门的时候...（讲述搞笑经历）
人物B：哈哈哈，太逗了！`,
    
    default: `旁白：在这个短视频中，我们将展示一个有趣的故事。
人物：让我来给大家演示一下...
旁白：通过这个例子，我们可以看到...`
  };
  
  // 根据标题关键词选择模板
  for (const [keyword, template] of Object.entries(templates)) {
    if (title && title.includes(keyword)) {
      return template;
    }
  }
  
  return templates.default;
}

// 模拟生成分镜脚本
function generateMockScript(title, transcript) {
  const lines = transcript.split('\n').filter(line => line.trim());
  const scenes = [];
  
  let currentTime = 0;
  const timePerLine = 5; // 每句话大约5秒
  
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