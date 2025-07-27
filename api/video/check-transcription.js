// 查询视频转文字任务状态
const https = require('https');
const fs = require('fs');
const path = require('path');

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

async function handler(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // 仅支持 GET
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: '仅支持 GET 请求'
      }
    });
    return;
  }
  
  try {
    // 从查询参数获取 taskId
    const taskId = req.query.taskId;
    
    if (!taskId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须提供 taskId'
        }
      });
      return;
    }
    
    console.log('查询任务状态:', taskId);
    
    // 首先检查内存中是否有结果（从回调存储的）
    if (global.yunmaoResults && global.yunmaoResults[taskId]) {
      const result = global.yunmaoResults[taskId];
      
      if (result.status === 'completed') {
        res.status(200).json({
          success: true,
          data: {
            taskId,
            status: 'completed',
            text: result.text,
            completedAt: result.completedAt
          }
        });
        return;
      } else if (result.status === 'failed') {
        res.status(400).json({
          success: false,
          error: {
            code: 'TASK_FAILED',
            message: result.error || '任务处理失败'
          }
        });
        return;
      }
    }
    
    // 如果内存中没有，调用云猫状态查询 API
    const options = {
      hostname: 'api.guangfan.tech',
      path: `/v1/get-status?id=${encodeURIComponent(taskId)}`,
      method: 'GET',
      headers: {
        'api-key': process.env.YUNMAO_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    const apiReq = https.request(options, (apiRes) => {
      let responseData = '';
      apiRes.on('data', chunk => responseData += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          console.log('云猫状态查询响应:', parsed);
          
          if (parsed.code === 0) {
            // 任务完成
            res.status(200).json({
              success: true,
              data: {
                taskId,
                status: 'completed',
                text: parsed.data,
                source: 'api'
              }
            });
          } else if (parsed.code === 6001) {
            // 处理中
            res.status(200).json({
              success: true,
              data: {
                taskId,
                status: 'processing',
                message: '任务处理中，请稍后再试'
              }
            });
          } else {
            // 其他错误
            res.status(400).json({
              success: false,
              error: {
                code: `YUNMAO_${parsed.code}`,
                message: parsed.message || '云猫 API 错误'
              }
            });
          }
        } catch (error) {
          console.error('解析响应失败:', error);
          res.status(500).json({
            success: false,
            error: {
              code: 'PARSE_ERROR',
              message: '解析云猫响应失败'
            }
          });
        }
      });
    });
    
    apiReq.on('error', (error) => {
      console.error('请求失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REQUEST_ERROR',
          message: error.message
        }
      });
    });
    
    apiReq.end();
    
  } catch (error) {
    console.error('处理错误:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}

module.exports = handler;