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
async function extractVideoId(url) {
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
  
  // 处理短链接 - 需要通过重定向获取真实URL
  const shortLinkMatch = url.match(/v\.douyin\.com\/([a-zA-Z0-9]+)/);
  if (shortLinkMatch) {
    console.log('检测到短链接，尝试获取重定向...');
    try {
      // 获取重定向后的URL
      const redirectedUrl = await followRedirect(url);
      console.log('重定向后的URL:', redirectedUrl);
      
      // 从重定向后的URL提取ID
      const videoIdMatch = redirectedUrl.match(/video\/(\d+)/);
      if (videoIdMatch) {
        return videoIdMatch[1];
      }
      
      // 尝试其他模式
      const modalIdMatch = redirectedUrl.match(/modal_id=(\d+)/);
      if (modalIdMatch) {
        return modalIdMatch[1];
      }
      
      // 尝试从重定向URL中寻找19位数字ID
      const idMatch = redirectedUrl.match(/(\d{19})/);
      if (idMatch) {
        return idMatch[1];
      }
    } catch (error) {
      console.error('获取重定向失败:', error.message);
      // 如果重定向失败，TikHub可能支持直接使用短链接代码作为参数
      // 但这需要不同的API端点
    }
  }
  
  return null;
}

// 跟随重定向获取最终URL
function followRedirect(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // 处理重定向
        resolve(res.headers.location);
      } else {
        reject(new Error(`无法获取重定向: ${res.statusCode}`));
      }
    });
    
    req.on('error', reject);
    req.end();
  });
}

// 调用 TikHub API 解析视频地址
async function resolveVideoUrl(shareUrl) {
  return new Promise(async (resolve, reject) => {
    const debugInfo = {
      originalUrl: shareUrl,
      videoId: null,
      tikhubError: null,
      tikhubResponse: null
    };
    
    // 尝试提取视频ID
    const videoId = await extractVideoId(shareUrl);
    debugInfo.videoId = videoId;
    
    // 如果无法提取ID（比如短链接），暂时跳过TikHub
    if (!videoId) {
      console.log('无法提取视频ID，跳过TikHub解析');
      debugInfo.tikhubError = '无法从URL提取视频ID';
      // 返回调试信息而不是直接 reject
      resolve({ error: true, debugInfo, message: '无法从URL提取视频ID' });
      return;
    }
    
    console.log('提取到视频ID:', videoId);
    
    // 使用 App API v3 端点，返回更完整的数据
    const queryParams = `?aweme_id=${encodeURIComponent(videoId)}`;
    const options = {
      hostname: 'api.tikhub.io',
      path: `/api/v1/douyin/app/v3/fetch_one_video${queryParams}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TIKHUB_API_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'TikHub-API-Demo/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          console.log('TikHub 响应状态码:', res.statusCode);
          debugInfo.tikhubResponse = {
            statusCode: res.statusCode,
            headers: res.headers,
            bodyLength: responseData.length,
            bodyPreview: responseData.substring(0, 1000),
            // 尝试解析并显示响应的前几层结构
            parsedPreview: (() => {
              try {
                const preview = JSON.parse(responseData);
                return {
                  topKeys: Object.keys(preview || {}),
                  dataKeys: preview.data ? Object.keys(preview.data).slice(0, 20) : null,
                  hasAwemeList: !!preview.data?.aweme_list,
                  hasItemList: !!preview.data?.item_list,
                  awemeListLength: preview.data?.aweme_list?.length || 0
                };
              } catch (e) {
                return 'Parse error';
              }
            })()
          };
          
          if (res.statusCode !== 200) {
            console.log('TikHub 错误响应:', responseData.substring(0, 200));
            debugInfo.tikhubError = `HTTP ${res.statusCode}: ${responseData.substring(0, 200)}`;
            resolve({ error: true, debugInfo, message: `TikHub API 错误: ${res.statusCode}` });
            return;
          }
          
          const parsed = JSON.parse(responseData);
          
          // 记录响应结构
          debugInfo.responseStructure = {
            hasAwemeDetail: !!parsed.aweme_detail,
            hasItem: !!parsed.item,
            hasData: !!parsed.data,
            topLevelKeys: Object.keys(parsed).slice(0, 10)
          };
          
          // 尝试多种解析路径
          let video = null;
          let urlList = [];
          
          // 尝试不同的数据路径
          // App API v3 可能返回 aweme_list 数组
          if (parsed.data?.aweme_list && parsed.data.aweme_list.length > 0) {
            video = parsed.data.aweme_list[0];
            debugInfo.dataPath = 'data.aweme_list[0]';
          } else if (parsed.data?.aweme_detail) {
            video = parsed.data.aweme_detail;
            debugInfo.dataPath = 'data.aweme_detail';
          } else if (parsed.data?.item) {
            video = parsed.data.item;
            debugInfo.dataPath = 'data.item';
          } else if (parsed.data) {
            video = parsed.data;
            debugInfo.dataPath = 'data';
          } else if (parsed.aweme_detail) {
            video = parsed.aweme_detail;
            debugInfo.dataPath = 'aweme_detail';
          } else if (parsed.item) {
            video = parsed.item;
            debugInfo.dataPath = 'item';
          } else {
            video = parsed;
            debugInfo.dataPath = 'root';
          }
          
          // 提取视频URL列表
          if (video) {
            // 尝试多种路径获取视频URL
            urlList = video.video?.play_addr?.url_list || 
                     video.video?.play_addr?.urls || 
                     video.video?.download_addr?.url_list ||
                     video.video?.bit_rate?.[0]?.play_addr?.url_list ||
                     [];
            
            // 如果还是没有，尝试其他可能的路径
            if (urlList.length === 0 && video.video) {
              // 遍历video对象寻找可能的URL数组
              for (const key of Object.keys(video.video)) {
                const value = video.video[key];
                if (value && typeof value === 'object') {
                  const urls = value.url_list || value.urls || [];
                  if (Array.isArray(urls) && urls.length > 0) {
                    urlList = urls;
                    debugInfo.urlFoundIn = key;
                    break;
                  }
                }
              }
            }
            
            // 记录视频对象结构
            debugInfo.videoStructure = {
              hasVideo: !!video.video,
              hasPlayAddr: !!video.video?.play_addr,
              hasDownloadAddr: !!video.video?.download_addr,
              hasBitRate: !!video.video?.bit_rate,
              videoKeys: video.video ? Object.keys(video.video).slice(0, 20) : []
            };
          }
          
          console.log(`找到 ${urlList.length} 个视频地址`);
          debugInfo.videoUrlsFound = urlList.length;
          
          // 选择最佳URL
          const validUrls = urlList.filter(url => {
            return url && typeof url === 'string' && url.startsWith('http');
          });
          
          if (validUrls.length > 0) {
            console.log('选择视频链接:', validUrls[0].substring(0, 80) + '...');
            resolve({ success: true, url: validUrls[0], debugInfo });
          } else {
            debugInfo.tikhubError = 'TikHub 未返回可用的视频地址';
            resolve({ error: true, debugInfo, message: 'TikHub 未返回可用的视频地址' });
          }
        } catch (error) {
          console.log('解析错误，原始响应长度:', responseData.length);
          debugInfo.tikhubError = `解析错误: ${error.message}`;
          resolve({ error: true, debugInfo, message: `解析 TikHub 响应失败: ${error.message}` });
        }
      });
    });
    
    req.on('error', (error) => {
      debugInfo.tikhubError = `请求错误: ${error.message}`;
      resolve({ error: true, debugInfo, message: `TikHub 请求失败: ${error.message}` });
    });
    
    req.end();
  });
}

// 调用云猫（广帆）转码 API
async function callYunmao(videoUrl) {
  return new Promise((resolve, reject) => {
    // 准备一个简单的回调服务器来接收结果
    // 在实际生产环境中，应该使用真实的回调地址
    const notifyUrl = 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback';
    
    // 步骤1：创建任务
    const createTaskData = JSON.stringify({
      language: 'chinese',
      fileUrl: videoUrl,
      notifyUrl: notifyUrl,
      resultType: 'str', // 直接返回文本字符串
      chat: false // 不使用对话模式
    });
    
    const createOptions = {
      hostname: 'api.guangfan.tech',
      path: '/v1/get-text',
      method: 'POST',
      headers: {
        'api-key': process.env.YUNMAO_API_KEY,
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
          
          if (parsed.code !== 0) {
            reject(new Error(`云猫 API 错误: ${parsed.message || '未知错误'}`));
            return;
          }
          
          const taskId = parsed.data;
          
          if (!taskId) {
            reject(new Error('云猫未返回任务ID'));
            return;
          }
          
          console.log('云猫任务创建成功，任务ID:', taskId);
          
          // 开始轮询任务结果
          pollTaskResult(taskId, resolve, reject);
          
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

// 轮询任务结果（通过查询端点）
async function pollTaskResult(taskId, resolve, reject) {
  const maxWaitTime = 300000; // 最多等待5分钟
  const pollInterval = 5000; // 5秒查询一次
  const startTime = Date.now();
  
  console.log(`云猫任务 ${taskId} 已提交，开始轮询结果...`);
  
  // 记录任务创建时间（用于计算处理时长）
  if (!global.yunmaoResults) {
    global.yunmaoResults = {};
  }
  global.yunmaoResults[taskId] = {
    status: 'pending',
    createdAt: Date.now()
  };
  
  const poll = async () => {
    try {
      // 检查是否超时
      if (Date.now() - startTime > maxWaitTime) {
        reject(new Error('云猫任务处理超时'));
        return;
      }
      
      // 查询结果（内部查询，避免网络请求）
      const result = global.yunmaoResults?.[taskId];
      
      if (result && result.status === 'completed') {
        console.log(`云猫任务 ${taskId} 完成，文本长度: ${result.text?.length || 0}`);
        resolve(result.text || '');
      } else if (result && result.status === 'failed') {
        reject(new Error(`云猫任务失败: ${result.error}`));
      } else {
        // 继续轮询
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        console.log(`等待云猫任务完成... (${elapsed}秒)`);
        setTimeout(poll, pollInterval);
      }
    } catch (error) {
      console.error('轮询出错，继续尝试:', error.message);
      setTimeout(poll, pollInterval);
    }
  };
  
  // 开始轮询
  setTimeout(poll, 3000); // 3秒后开始第一次查询
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
    let tikhubDebugInfo = null;
    let videoResolverProvider = 'None';
    
    const resolveResult = await resolveVideoUrl(videoUrl);
    tikhubDebugInfo = resolveResult.debugInfo;
    
    if (resolveResult.success) {
      realVideoUrl = resolveResult.url;
      videoResolverProvider = 'TikHub';
      console.log('解析后的视频地址:', realVideoUrl);
    } else {
      console.error('TikHub 解析失败:', resolveResult.message);
      // 降级处理：如果 TikHub 失败，使用原链接
      realVideoUrl = videoUrl;
      videoResolverProvider = 'Fallback';
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
          videoResolver: videoResolverProvider,
          transcription: transcriptionProvider,
          scriptGenerator: 'TongYi'
        },
        extractedUrl: videoUrl,
        resolvedUrl: realVideoUrl,
        debugInfo: tikhubDebugInfo
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