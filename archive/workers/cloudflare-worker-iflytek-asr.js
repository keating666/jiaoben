/**
 * Cloudflare Worker - 讯飞语音识别实现
 * 使用 Node.js 兼容模式下的 crypto 模块
 * 
 * 部署说明：
 * 1. 在 wrangler.toml 中添加: compatibility_flags = ["nodejs_compat"]
 * 2. 配置环境变量: IFLYTEK_APP_ID, IFLYTEK_API_KEY, IFLYTEK_API_SECRET
 */

// 使用 node: 前缀导入 crypto 模块
import crypto from 'node:crypto';

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
    const path = url.pathname;
    
    try {
      // 测试端点
      if (path === '/api/test' || path === '/api/test/') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Worker正常运行 - 讯飞语音识别版',
          timestamp: new Date().toISOString(),
          iflytek: {
            configured: !!(env.IFLYTEK_APP_ID && env.IFLYTEK_API_SECRET && env.IFLYTEK_API_KEY),
            cryptoAvailable: typeof crypto !== 'undefined',
            features: ['hmac-sha256签名', 'WebSocket认证URL生成']
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 生成认证信息端点
      if (path === '/api/iflytek/auth') {
        if (!env.IFLYTEK_APP_ID || !env.IFLYTEK_API_SECRET || !env.IFLYTEK_API_KEY) {
          return new Response(JSON.stringify({
            success: false,
            error: '讯飞配置不完整'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        try {
          const authInfo = await generateIflytekAuth(
            env.IFLYTEK_APP_ID,
            env.IFLYTEK_API_KEY,
            env.IFLYTEK_API_SECRET
          );
          
          return new Response(JSON.stringify({
            success: true,
            authUrl: authInfo.url,
            headers: authInfo.headers,
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // 语音识别代理端点（由于 Workers 不支持 WebSocket 客户端，这里只能生成认证信息）
      if (path === '/api/iflytek/recognize') {
        if (request.method !== 'POST') {
          return new Response(JSON.stringify({
            error: 'Method not allowed'
          }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 检查配置
        if (!env.IFLYTEK_APP_ID || !env.IFLYTEK_API_SECRET || !env.IFLYTEK_API_KEY) {
          return new Response(JSON.stringify({
            error: '讯飞语音识别未配置'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 获取请求参数
        const body = await request.json();
        const { audioUrl, language = 'zh-CN' } = body;
        
        if (!audioUrl) {
          return new Response(JSON.stringify({
            error: '请提供音频URL'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 生成认证信息供客户端使用
        const authInfo = await generateIflytekAuth(
          env.IFLYTEK_APP_ID,
          env.IFLYTEK_API_KEY,
          env.IFLYTEK_API_SECRET
        );
        
        // 由于 Workers 不支持 WebSocket 客户端，返回认证信息让客户端直接连接
        return new Response(JSON.stringify({
          success: true,
          message: '请使用返回的认证信息从客户端直接连接讯飞 WebSocket API',
          authUrl: authInfo.url,
          wsConfig: {
            appId: env.IFLYTEK_APP_ID,
            language: getIflytekLanguageCode(language),
            audioUrl: audioUrl
          },
          instructions: {
            1: '使用 authUrl 建立 WebSocket 连接',
            2: '发送配置帧，包含 appId 和音频格式信息',
            3: '下载音频并分片发送到 WebSocket',
            4: '接收识别结果'
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 404 处理
      return new Response(JSON.stringify({
        error: 'Not found',
        availableEndpoints: [
          '/api/test',
          '/api/iflytek/auth',
          '/api/iflytek/recognize'
        ]
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Worker错误:', error);
      return new Response(JSON.stringify({
        error: '服务器内部错误',
        message: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },
};

/**
 * 生成讯飞认证信息
 * 使用 Node.js 兼容的 crypto 模块
 */
async function generateIflytekAuth(appId, apiKey, apiSecret) {
  const host = 'ws-api.xfyun.cn';
  const path = '/v2/iat';
  
  // 生成 RFC1123 格式的时间戳
  const date = new Date().toUTCString();
  
  // 生成签名原文
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  
  // 使用 node:crypto 的 hmac-sha256 进行加密
  const signatureSha = crypto
    .createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');
  
  // 构建 authorization 参数
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureSha}"`;
  
  // Base64 编码
  const authorization = btoa(authorizationOrigin);
  
  // 构建认证 URL
  const wsUrl = new URL(`wss://${host}${path}`);
  wsUrl.searchParams.append('authorization', authorization);
  wsUrl.searchParams.append('date', date);
  wsUrl.searchParams.append('host', host);
  
  return {
    url: wsUrl.toString(),
    headers: {
      authorization,
      date,
      host
    }
  };
}

/**
 * 语言代码转换
 */
function getIflytekLanguageCode(language) {
  const languageMap = {
    'zh-CN': 'zh_cn',
    'zh-TW': 'zh_tw',
    'en-US': 'en_us',
    'ja-JP': 'ja_jp',
    'ko-KR': 'ko_kr',
  };
  
  return languageMap[language] || 'zh_cn';
}

/**
 * 示例 wrangler.toml 配置：
 * 
 * name = "iflytek-asr-worker"
 * main = "cloudflare-worker-iflytek-asr.js"
 * compatibility_date = "2024-01-01"
 * compatibility_flags = ["nodejs_compat"]
 * 
 * [env.production.vars]
 * IFLYTEK_APP_ID = "your-app-id"
 * IFLYTEK_API_KEY = "your-api-key"
 * IFLYTEK_API_SECRET = "your-api-secret"
 */