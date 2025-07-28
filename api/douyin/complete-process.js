const https = require('https');

/**
 * 完整的抖音视频处理流程 - 从链接到脚本
 * 1. TikHub获取视频URL
 * 2. 云猫转文字
 * 3. AI生成脚本
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
      sseUrl: `/api/douyin/complete-process?taskId=${taskId}`
    });
    
  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({ error: error.message });
  }
}

// 处理SSE连接
function handleSSE(req, res) {
  const taskId = req.query.taskId;
  
  if (!taskId || !global.processingTasks || !global.processingTasks[taskId]) {
    res.write(`data: ${JSON.stringify({ error: '无效的任务ID' })}\n\n`);
    res.end();
    return;
  }
  
  // 发送当前状态
  const task = global.processingTasks[taskId];
  res.write(`data: ${JSON.stringify({
    type: 'status',
    status: task.status,
    steps: task.steps
  })}\n\n`);
  
  // 定期检查状态
  const interval = setInterval(() => {
    const currentTask = global.processingTasks[taskId];
    
    if (!currentTask) {
      clearInterval(interval);
      res.end();
      return;
    }
    
    // 发送更新
    res.write(`data: ${JSON.stringify({
      type: 'update',
      status: currentTask.status,
      steps: currentTask.steps,
      currentStep: currentTask.currentStep
    })}\n\n`);
    
    // 如果完成或失败，关闭连接
    if (currentTask.status === 'completed' || currentTask.status === 'failed') {
      clearInterval(interval);
      setTimeout(() => {
        res.write(`data: ${JSON.stringify({
          type: 'final',
          status: currentTask.status,
          result: currentTask.result,
          error: currentTask.error,
          totalTime: Date.now() - currentTask.startTime
        })}\n\n`);
        res.end();
      }, 100);
    }
  }, 1000);
  
  // 客户端断开时清理
  req.on('close', () => {
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
    
    const transcriptData = await submitToYunmao(videoUrl);
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

// TikHub获取视频
async function getVideoFromTikHub(douyinUrl) {
  return new Promise((resolve, reject) => {
    // 模拟TikHub API调用
    setTimeout(() => {
      // 实际实现时调用真实的TikHub API
      resolve('https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4');
    }, 2000);
  });
}

// 提交到云猫
async function submitToYunmao(videoUrl) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify({
      language: 'chinese',
      fileUrl: videoUrl,
      notifyUrl: 'https://jiaoben-7jx4.vercel.app/api/yunmao-callback',
      resultType: 'str',
      chat: false
    });
    
    const options = {
      hostname: 'api.guangfan.tech',
      path: '/v1/get-text',
      method: 'POST',
      headers: {
        'api-key': process.env.YUNMAO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.code === 0) {
            resolve({ taskId: parsed.data });
          } else {
            reject(new Error(parsed.message || '云猫API错误'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

// 等待云猫结果
async function waitForYunmaoResult(taskId, yunmaoTaskId) {
  return new Promise((resolve, reject) => {
    let checkCount = 0;
    const maxChecks = 60;
    
    const checkInterval = setInterval(async () => {
      checkCount++;
      
      // 检查回调结果
      if (global.yunmaoResults && global.yunmaoResults[yunmaoTaskId]) {
        const result = global.yunmaoResults[yunmaoTaskId];
        if (result.status === 'completed') {
          clearInterval(checkInterval);
          resolve(result.text);
          return;
        } else if (result.status === 'failed') {
          clearInterval(checkInterval);
          reject(new Error(result.error));
          return;
        }
      }
      
      // 更新进度
      updateTask(taskId, 'step', {
        name: '云猫转文字',
        status: 'processing',
        progress: Math.min(checkCount * 5, 90)
      });
      
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        reject(new Error('云猫处理超时'));
      }
    }, 5000);
  });
}

// AI生成脚本
async function generateScript(transcript, style) {
  // 这里应该调用通义千问或其他AI服务
  // 暂时返回模拟数据
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        title: "AI生成的视频脚本",
        style: style,
        sections: [
          {
            type: "introduction",
            content: "基于视频内容生成的开场介绍..."
          },
          {
            type: "main",
            content: transcript.substring(0, 200) + "..."
          },
          {
            type: "conclusion",
            content: "总结性结尾..."
          }
        ]
      });
    }, 3000);
  });
}

module.exports = handler;