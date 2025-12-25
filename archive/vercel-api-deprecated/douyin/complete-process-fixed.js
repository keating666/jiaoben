const https = require('https');

/**
 * 完整的抖音视频处理流程 - 修正版
 * 使用正确的TikHub API端点
 */
async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] 完整流程处理开始`);
  
  // 设置CORS和SSE
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 如果是SSE请求
  if (req.headers.accept === 'text/event-stream') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    handleSSE(req, res);
    return;
  }
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: '仅支持POST请求' });
    return;
  }
  
  try {
    const { douyinUrl, style = 'default' } = req.body;
    
    if (!douyinUrl) {
      res.status(400).json({ error: '请提供抖音链接' });
      return;
    }
    
    // 创建处理任务
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 初始化任务状态
    if (!global.processingTasks) {
      global.processingTasks = {};
    }
    
    global.processingTasks[taskId] = {
      status: 'processing',
      steps: [],
      startTime: Date.now()
    };
    
    // 异步处理
    processVideo(taskId, douyinUrl, style);
    
    res.status(200).json({
      success: true,
      taskId,
      message: '任务已创建，请通过SSE监听进度',
      sseUrl: `/api/douyin/complete-process-fixed?taskId=${taskId}`
    });
    
  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({ error: error.message });
  }
}

// 处理SSE连接（复用原有代码）
function handleSSE(req, res) {
  const taskId = req.query.taskId;
  
  console.log(`[SSE] 新连接: ${taskId}`);
  
  if (!taskId || !global.processingTasks || !global.processingTasks[taskId]) {
    console.log(`[SSE] 无效任务ID: ${taskId}`);
    res.write(`data: ${JSON.stringify({ error: '无效的任务ID' })}\n\n`);
    res.end();
    return;
  }
  
  // 发送当前状态
  const task = global.processingTasks[taskId];
  let lastStatus = JSON.stringify(task.steps);
  
  res.write(`data: ${JSON.stringify({
    type: 'status',
    status: task.status,
    steps: task.steps
  })}\n\n`);
  
  // 定期检查状态
  const interval = setInterval(() => {
    const currentTask = global.processingTasks[taskId];
    
    if (!currentTask) {
      console.log(`[SSE] 任务不存在: ${taskId}`);
      clearInterval(interval);
      res.end();
      return;
    }
    
    // 只在状态变化时发送更新
    const currentStatus = JSON.stringify(currentTask.steps);
    if (currentStatus !== lastStatus || currentTask.status === 'completed' || currentTask.status === 'failed') {
      lastStatus = currentStatus;
      
      console.log(`[SSE] 发送更新: ${taskId}, 状态: ${currentTask.status}`);
      
      res.write(`data: ${JSON.stringify({
        type: 'update',
        status: currentTask.status,
        steps: currentTask.steps,
        currentStep: currentTask.currentStep
      })}\n\n`);
    }
    
    // 如果完成或失败，关闭连接
    if (currentTask.status === 'completed' || currentTask.status === 'failed') {
      clearInterval(interval);
      setTimeout(() => {
        console.log(`[SSE] 任务结束: ${taskId}, 状态: ${currentTask.status}`);
        res.write(`data: ${JSON.stringify({
          type: 'final',
          status: currentTask.status,
          result: currentTask.result,
          error: currentTask.error,
          totalTime: Date.now() - currentTask.startTime
        })}\n\n`);
        res.end();
        
        // 清理任务数据
        setTimeout(() => {
          delete global.processingTasks[taskId];
          console.log(`[SSE] 清理任务: ${taskId}`);
        }, 5000);
      }, 100);
    }
  }, 1000);
  
  // 客户端断开时清理
  req.on('close', () => {
    console.log(`[SSE] 客户端断开: ${taskId}`);
    clearInterval(interval);
  });
}

// 异步处理视频
async function processVideo(taskId, douyinUrl, style) {
  const task = global.processingTasks[taskId];
  
  try {
    // 步骤1: TikHub获取视频
    updateTask(taskId, 'step', {
      name: 'TikHub解析',
      status: 'processing',
      startTime: Date.now()
    });
    
    const videoUrl = await getVideoFromTikHub(douyinUrl);
    
    updateTask(taskId, 'step', {
      name: 'TikHub解析',
      status: 'completed',
      result: videoUrl,
      endTime: Date.now()
    });
    
    // 步骤2: 云猫转文字
    updateTask(taskId, 'step', {
      name: '云猫转文字',
      status: 'processing',
      startTime: Date.now()
    });
    
    console.log(`[云猫] 准备提交视频URL: ${videoUrl}`);
    const transcriptData = await submitToYunmao(videoUrl);
    console.log(`[云猫] 提交成功，云猫任务ID: ${transcriptData.taskId}`);
    const transcript = await waitForYunmaoResult(taskId, transcriptData.taskId);
    
    updateTask(taskId, 'step', {
      name: '云猫转文字',
      status: 'completed',
      result: transcript.substring(0, 100) + '...',
      endTime: Date.now()
    });
    
    // 步骤3: AI生成脚本
    updateTask(taskId, 'step', {
      name: 'AI脚本生成',
      status: 'processing',
      startTime: Date.now()
    });
    
    const script = await generateScript(transcript, style);
    
    updateTask(taskId, 'step', {
      name: 'AI脚本生成',
      status: 'completed',
      result: '脚本生成完成',
      endTime: Date.now()
    });
    
    // 完成
    task.status = 'completed';
    task.result = {
      videoUrl,
      transcript,
      script
    };
    
  } catch (error) {
    console.error('处理失败:', error);
    task.status = 'failed';
    task.error = error.message;
  }
}

// 更新任务状态
function updateTask(taskId, type, data) {
  const task = global.processingTasks[taskId];
  if (!task) return;
  
  if (type === 'step') {
    const existingStep = task.steps.find(s => s.name === data.name);
    if (existingStep) {
      Object.assign(existingStep, data);
    } else {
      task.steps.push(data);
    }
    task.currentStep = data.name;
  }
}

// TikHub获取视频 - 使用正确的API
async function getVideoFromTikHub(douyinUrl) {
  return new Promise((resolve, reject) => {
    // 使用正确的API端点
    const options = {
      hostname: 'api.tikhub.io',
      path: `/api/v1/douyin/web/fetch_one_video_by_share_url?share_url=${encodeURIComponent(douyinUrl)}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TIKHUB_API_KEY}`,
        'Accept': 'application/json'
      }
    };
    
    console.log(`[TikHub] 请求URL: https://${options.hostname}${options.path}`);
    
    const req = https.get(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          console.log('[TikHub] 响应状态:', res.statusCode);
          
          if (res.statusCode !== 200) {
            console.error('[TikHub] API错误:', parsed);
            // 返回原始URL让云猫尝试
            resolve(douyinUrl);
            return;
          }
          
          if (parsed.code === 0 && parsed.data) {
            // 根据TikHub文档，视频URL可能在不同字段
            const video = parsed.data.video || parsed.data;
            
            // 尝试多个可能的字段
            let videoUrl = null;
            
            // 检查 play_addr
            if (video.play_addr?.url_list?.length > 0) {
              videoUrl = video.play_addr.url_list[0];
            }
            // 检查 download_addr
            else if (video.download_addr?.url_list?.length > 0) {
              videoUrl = video.download_addr.url_list[0];
            }
            // 检查其他可能的字段
            else if (video.play) {
              videoUrl = video.play;
            }
            else if (video.download) {
              videoUrl = video.download;
            }
            
            if (videoUrl) {
              console.log('[TikHub] 获取到视频URL:', videoUrl.substring(0, 50) + '...');
              resolve(videoUrl);
            } else {
              console.log('[TikHub] 未找到视频URL，返回原始链接');
              resolve(douyinUrl);
            }
          } else {
            console.log('[TikHub] API返回格式错误，使用原始URL');
            resolve(douyinUrl);
          }
        } catch (error) {
          console.error('[TikHub] 解析响应失败:', error);
          resolve(douyinUrl);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('[TikHub] 请求错误:', error);
      resolve(douyinUrl);
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      console.log('[TikHub] 请求超时，使用原始URL');
      resolve(douyinUrl);
    });
  });
}

// 提交到云猫（复用原有代码）
async function submitToYunmao(videoUrl) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      language: 'chinese',
      fileUrl: videoUrl,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-events',
      resultType: 'txt',
      chat: false
    });
    
    const options = {
      hostname: 'api.guangfan.tech',
      path: '/v1/get-text',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.YUNMAO_API_KEY || '',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          console.log('[云猫] 响应:', parsed);
          
          if (parsed.code === 0) {
            resolve({
              taskId: parsed.data,
              status: 'submitted'
            });
          } else {
            reject(new Error(`云猫API错误: ${parsed.message || '未知错误'}`));
          }
        } catch (error) {
          reject(new Error('解析云猫响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('云猫请求超时'));
    });
    
    req.write(requestData);
    req.end();
  });
}

// 等待云猫结果（复用原有代码）
async function waitForYunmaoResult(taskId, yunmaoTaskId) {
  console.log(`[云猫] 开始等待任务完成: ${yunmaoTaskId}`);
  
  let attempts = 0;
  const maxAttempts = 60; // 最多等待5分钟
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // 等待5秒
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      const status = await checkYunmaoStatus(yunmaoTaskId);
      
      updateTask(taskId, 'step', {
        name: '云猫转文字',
        status: 'processing',
        progress: `检查中... (第${attempts}次)`,
        startTime: Date.now()
      });
      
      if (status.code === 0 && status.data) {
        console.log(`[云猫] 任务完成`);
        
        // 如果是URL，下载文本内容
        if (status.data.startsWith('http')) {
          const text = await downloadText(status.data);
          return text;
        } else {
          return status.data;
        }
      }
    } catch (error) {
      console.error(`[云猫] 检查状态失败:`, error);
    }
  }
  
  throw new Error('云猫处理超时');
}

// 检查云猫状态
async function checkYunmaoStatus(taskId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.guangfan.tech',
      path: `/v1/get-status?id=${taskId}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.YUNMAO_API_KEY || ''
      }
    };
    
    const req = https.get(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          reject(new Error('解析状态响应失败'));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('状态查询超时'));
    });
  });
}

// 下载文本内容
async function downloadText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 生成脚本（简化版）
async function generateScript(transcript, style) {
  // 这里应该调用通义千问API
  // 暂时返回模拟数据
  return {
    title: '视频脚本',
    style: style,
    content: transcript,
    scenes: [
      {
        scene: 1,
        content: transcript.substring(0, 100),
        duration: '10s'
      }
    ]
  };
}

module.exports = handler;