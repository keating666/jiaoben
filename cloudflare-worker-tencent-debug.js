/**
 * Cloudflare Worker - 腾讯云ASR调试版本
 * 用于调试API请求和响应
 */

import crypto from 'node:crypto';

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // 调试端点 - 显示完整的API请求细节
      if (path === '/api/debug' || path === '/api/debug/') {
        const testUrl = 'https://www.w3schools.com/html/horse.mp3';
        
        const endpoint = 'asr.tencentcloudapi.com';
        const service = 'asr';
        const action = 'CreateRecTask';
        const version = '2019-06-14';
        const region = 'ap-shanghai';
        
        const timestamp = Math.floor(Date.now() / 1000);
        const date = new Date(timestamp * 1000).toISOString().substr(0, 10);
        
        // 请求参数
        const params = {
          EngineModelType: '16k_zh',
          ChannelNum: 1,
          ResTextFormat: 0,
          SourceType: 0,
          Url: testUrl
        };
        
        const payload = JSON.stringify(params);
        
        // 生成签名
        const signature = await generateTencentSignature({
          secretId: env.TENCENT_SECRET_ID,
          secretKey: env.TENCENT_SECRET_KEY,
          service,
          host: endpoint,
          action,
          version,
          timestamp,
          date,
          payload
        });
        
        // 构建请求headers
        const headers = {
          'Content-Type': 'application/json',
          'X-TC-Action': action,
          'X-TC-Version': version,
          'X-TC-Timestamp': timestamp.toString(),
          'X-TC-Region': region,
          'Authorization': signature
        };
        
        // 调试信息
        const debugInfo = {
          step1_params: params,
          step2_payload: payload,
          step3_headers: headers,
          step4_signature_parts: {
            algorithm: 'TC3-HMAC-SHA256',
            date: date,
            timestamp: timestamp,
            service: service,
            region: region,
            action: action,
            version: version
          }
        };
        
        // 发送请求
        const response = await fetch(`https://${endpoint}/`, {
          method: 'POST',
          headers: headers,
          body: payload
        });
        
        const responseText = await response.text();
        let responseJson;
        try {
          responseJson = JSON.parse(responseText);
        } catch (e) {
          responseJson = { parseError: true, rawResponse: responseText };
        }
        
        // 返回调试信息
        return new Response(JSON.stringify({
          request: debugInfo,
          response: {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseJson
          },
          hints: {
            errorCode: responseJson?.Response?.Error?.Code,
            errorMessage: responseJson?.Response?.Error?.Message,
            possibleIssues: [
              'User is unopened - 需要在腾讯云控制台开通ASR服务',
              'AuthFailure - 检查密钥是否正确',
              'InvalidParameter - 检查参数格式'
            ]
          }
        }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 根路径
      return new Response('Tencent ASR Debug Worker', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }, null, 2), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// 生成腾讯云签名
async function generateTencentSignature(options) {
  const { secretId, secretKey, service, host, action, version, timestamp, date, payload } = options;
  
  // 1. 拼接规范请求串
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  
  const hashedPayload = crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
  
  const canonicalRequest = 
    `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n` +
    `${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;
  
  // 2. 拼接待签名字符串
  const algorithm = 'TC3-HMAC-SHA256';
  const hashedCanonicalRequest = crypto
    .createHash('sha256')
    .update(canonicalRequest)
    .digest('hex');
  
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = 
    `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;
  
  // 3. 计算签名
  const secretDate = crypto
    .createHmac('sha256', `TC3${secretKey}`)
    .update(date)
    .digest();
  
  const secretService = crypto
    .createHmac('sha256', secretDate)
    .update(service)
    .digest();
  
  const secretSigning = crypto
    .createHmac('sha256', secretService)
    .update('tc3_request')
    .digest();
  
  const signature = crypto
    .createHmac('sha256', secretSigning)
    .update(stringToSign)
    .digest('hex');
  
  // 4. 拼接 Authorization
  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}