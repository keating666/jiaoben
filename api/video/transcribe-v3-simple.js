// 简化的 JavaScript 版本 transcribe-v3
const fs = require('fs');
const path = require('path');
const https = require('https');

// 加载环境变量
function loadEnv() {
  const envPath = path.join(__dirname, '../../tech-validation/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
}

// 加载环境变量
loadEnv();

// 简单的抖音链接提取
function extractDouyinUrl(text) {
  const patterns = [
    /https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+/,
    /https?:\/\/www\.douyin\.com\/video\/\d+/,
    /https?:\/\/www\.iesdouyin\.com\/share\/video\/\d+/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

// 调用通义千问
async function callTongyi(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: process.env.TONGYI_MODEL || 'qwen-turbo',
      input: {
        messages: [
          {
            role: 'system',
            content: '你是一个专业的视频脚本编辑。请根据提供的视频文字内容，生成一个包含3-5个场景的分镜头脚本。每个场景包含：场景编号、时间戳、描述、对话、备注。请以JSON格式返回。'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        max_tokens: 1500
      }
    });
    
    const options = {
      hostname: 'dashscope.aliyuncs.com',
      path: '/api/v1/services/aigc/text-generation/generation',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TONGYI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.output && parsed.output.text) {
            resolve(parsed.output.text);
          } else if (parsed.output && parsed.output.choices) {
            resolve(parsed.output.choices[0].message.content);
          } else {
            reject(new Error('通义千问返回格式错误'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 提取抖音视频ID
function extractVideoId(url) {
  // 处理短链接（需要重定向获取真实ID，这里暂时跳过）
  const shortLinkMatch = url.match(/v\.douyin\.com\/([a-zA-Z0-9]+)/);
  if (shortLinkMatch) {
    console.log('检测到短链接，暂时无法直接提取ID');
    return null;
  }
  
  // 处理长链接
  const longLinkMatch = url.match(/video\/(\d+)/);
  if (longLinkMatch) {
    return longLinkMatch[1];
  }
  
  // 处理其他格式
  const patterns = [
    /aweme_id=(\d+)/,
    /\/(\d{19})/,
    /modal_id=(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// 调用 TikHub API 解析视频地址
async function resolveVideoUrl(shareUrl) {
  return new Promise((resolve, reject) => {
    // 尝试提取视频ID
    const videoId = extractVideoId(shareUrl);
    
    // 如果无法提取ID（比如短链接），暂时跳过TikHub
    if (!videoId) {
      console.log('无法提取视频ID，跳过TikHub解析');
      reject(new Error('无法从URL提取视频ID'));
      return;
    }
    
    console.log('提取到视频ID:', videoId);
    
    // 使用 GET 请求，正确的端点路径
    const queryParams = `?aweme_id=${encodeURIComponent(videoId)}`;
    const options = {
      hostname: 'api.tikhub.io',
      path: `/api/v1/douyin/web/fetch_one_video${queryParams}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TIKHUB_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          console.log('TikHub 响应状态码:', res.statusCode);
          
          if (res.statusCode !== 200) {
            console.log('TikHub 错误响应:', responseData.substring(0, 200));
            reject(new Error(`TikHub API 错误: ${res.statusCode}`));
            return;
          }
          
          const parsed = JSON.parse(responseData);
          
          // 根据TikHub客户端代码，解析响应
          const video = parsed.aweme_detail || parsed.item || parsed;
          const urlList = video.video?.play_addr?.url_list || [];
          
          console.log(`找到 ${urlList.length} 个视频地址`);
          
          // 选择最佳URL
          const validUrls = urlList.filter(url => {
            return url && typeof url === 'string' && url.startsWith('http');
          });
          
          if (validUrls.length > 0) {
            console.log('选择视频链接:', validUrls[0].substring(0, 80) + '...');
            resolve(validUrls[0]);
          } else {
            reject(new Error('TikHub 未返回可用的视频地址'));
          }
        } catch (error) {
          console.log('解析错误，原始响应长度:', responseData.length);
          reject(new Error(`解析 TikHub 响应失败: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`TikHub 请求失败: ${error.message}`));
    });
    
    req.end();
  });
}

// 调用云猫转码 API
async function callYunmao(videoUrl) {
  return new Promise((resolve, reject) => {
    // 步骤1：创建任务
    const createTaskData = JSON.stringify({
      video_url: videoUrl,
      language: 'zh-CN',
      output_format: 'text'
    });
    
    const createOptions = {
      hostname: 'api.yunmaovideo.com',
      path: '/v1/extract-text',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.YUNMAO_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(createTaskData)
      }
    };
    
    const createReq = https.request(createOptions, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          console.log('云猫创建任务响应状态:', res.statusCode);
          
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            console.log('云猫错误响应:', responseData.substring(0, 200));
            reject(new Error(`云猫 API 错误: ${res.statusCode}`));
            return;
          }
          
          const parsed = JSON.parse(responseData);
          const taskId = parsed.task_id || parsed.id;
          
          if (!taskId) {
            reject(new Error('云猫未返回任务ID'));
            return;
          }
          
          console.log('云猫任务创建成功，任务ID:', taskId);
          
          // 步骤2：轮询任务状态
          pollTaskStatus(taskId, resolve, reject);
          
        } catch (error) {
          reject(new Error(`解析云猫响应失败: ${error.message}`));
        }
      });
    });
    
    createReq.on('error', (error) => {
      reject(new Error(`云猫请求失败: ${error.message}`));
    });
    
    createReq.write(createTaskData);
    createReq.end();
  });
}

// 轮询任务状态
async function pollTaskStatus(taskId, resolve, reject) {
  const maxAttempts = 60; // 最多尝试60次
  const pollInterval = 5000; // 5秒间隔
  let attempts = 0;
  
  const poll = () => {
    attempts++;
    
    if (attempts > maxAttempts) {
      reject(new Error('云猫任务处理超时'));
      return;
    }
    
    const options = {
      hostname: 'api.yunmaovideo.com',
      path: `/v1/tasks/${taskId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.YUNMAO_API_KEY}`
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          console.log(`云猫任务状态 (${attempts}/${maxAttempts}):`, parsed.status);
          
          if (parsed.status === 'completed') {
            const text = parsed.result?.text || parsed.text || '';
            console.log('云猫转录完成，文本长度:', text.length);
            resolve(text);
          } else if (parsed.status === 'failed') {
            reject(new Error(`云猫任务失败: ${parsed.error?.message || '未知错误'}`));
          } else {
            // 继续轮询
            setTimeout(poll, pollInterval);
          }
        } catch (error) {
          console.log('解析状态响应失败，继续尝试');
          setTimeout(poll, pollInterval);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log('查询状态失败，继续尝试:', error.message);
      setTimeout(poll, pollInterval);
    });
    
    req.end();
  };
  
  // 开始轮询
  setTimeout(poll, 2000); // 等待2秒后开始第一次查询
}

// 主处理函数
async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // 仅支持 POST
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: '仅支持 POST 请求'
      }
    });
    return;
  }
  
  // 检查授权
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '未提供有效的API密钥'
      }
    });
    return;
  }
  
  const startTime = Date.now();
  
  try {
    const body = req.body;
    let transcriptionProvider = 'Mock'; // 默认使用模拟数据
    
    // 验证输入
    if (!body.mixedText && !body.videoUrl) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须提供 mixedText 或 videoUrl'
        }
      });
      return;
    }
    
    // 步骤 1: 提取视频链接
    let videoUrl = body.videoUrl;
    if (!videoUrl && body.mixedText) {
      videoUrl = extractDouyinUrl(body.mixedText);
      if (!videoUrl) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_VIDEO_LINK',
            message: '未找到有效的视频链接'
          }
        });
        return;
      }
    }
    
    console.log('提取的视频链接:', videoUrl);
    
    // 步骤 2: 解析视频地址（调用 TikHub API）
    let realVideoUrl = videoUrl;
    try {
      realVideoUrl = await resolveVideoUrl(videoUrl);
      console.log('解析后的视频地址:', realVideoUrl);
    } catch (error) {
      console.error('TikHub 解析失败，使用原链接:', error.message);
      // 降级处理：如果 TikHub 失败，使用原链接
      realVideoUrl = videoUrl;
    }
    
    // 步骤 3: 视频转文字（调用云猫 API）
    let transcriptText = '';
    
    try {
      // 检查是否有云猫 API 密钥
      if (process.env.YUNMAO_API_KEY) {
        console.log('使用云猫 API 进行视频转文字...');
        transcriptText = await callYunmao(realVideoUrl);
        transcriptionProvider = 'Yunmao';
      } else {
        console.log('云猫 API 密钥未配置，使用模拟数据');
        throw new Error('YUNMAO_API_KEY not configured');
      }
    } catch (error) {
      console.error('云猫转录失败，使用模拟数据:', error.message);
      // 降级处理：使用模拟数据
      transcriptText = `这是一个有趣的短视频。
视频开始展示了一个搞笑的场景，主角在尝试做一个高难度动作。
随后镜头切换到观众的反应，大家都被逗笑了。
最后以一个意想不到的结局收尾，让人印象深刻。
整个视频节奏紧凑，充满欢乐气氛。`;
      transcriptionProvider = 'Mock';
    }
    
    console.log('转录文本长度:', transcriptText.length);
    console.log('转录服务提供商:', transcriptionProvider);
    
    // 步骤 4: 生成脚本
    const style = body.style || 'default';
    const stylePrompt = {
      default: '请生成标准的分镜头脚本',
      humorous: '请生成幽默风格的分镜头脚本，增加趣味性描述',
      professional: '请生成专业风格的分镜头脚本，使用专业术语'
    };
    
    let scriptData;
    try {
      const prompt = `${stylePrompt[style]}。视频内容：${transcriptText}`;
      const aiResponse = await callTongyi(prompt);
      
      // 尝试解析 AI 返回的 JSON
      try {
        scriptData = JSON.parse(aiResponse);
      } catch {
        // 如果不是 JSON，创建默认结构
        scriptData = {
          title: '视频脚本',
          duration: 60,
          scenes: [
            {
              scene_number: 1,
              timestamp: '00:00-00:20',
              description: '开场',
              dialogue: transcriptText.substring(0, 50),
              notes: '由 AI 生成'
            }
          ],
          ai_response: aiResponse
        };
      }
    } catch (error) {
      console.error('AI 生成失败:', error);
      // 使用备用脚本
      scriptData = {
        title: '视频脚本（备用）',
        duration: 60,
        scenes: [
          {
            scene_number: 1,
            timestamp: '00:00-00:20',
            description: '开场画面',
            dialogue: '搞笑场景开始',
            notes: '主角登场'
          },
          {
            scene_number: 2,
            timestamp: '00:20-00:40',
            description: '主要内容',
            dialogue: '高难度动作尝试',
            notes: '观众反应'
          },
          {
            scene_number: 3,
            timestamp: '00:40-01:00',
            description: '结尾',
            dialogue: '意想不到的结局',
            notes: '全场爆笑'
          }
        ]
      };
    }
    
    const processingTime = Date.now() - startTime;
    
    // 返回响应
    res.status(200).json({
      success: true,
      data: {
        originalText: transcriptText,
        script: scriptData,
        processingTime: processingTime,
        provider: {
          videoResolver: 'TikHub',
          transcription: transcriptionProvider,
          scriptGenerator: 'TongYi'
        }
      }
    });
    
  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || '处理失败',
        retryable: true
      }
    });
  }
}

module.exports = handler;