/**
 * Cloudflare Worker - 超级调试版本
 * 用于深度分析语音识别失败的原因
 */

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
      // 超级调试端点
      if (path === '/api/ultra-debug' || path === '/api/ultra-debug/') {
        const body = await request.json();
        const audioUrl = body.audioUrl || 'https://sf6-cdn-tos.douyinstatic.com/obj/ies-music/7531294223631846198.mp3';
        
        const debugLog = [];
        const timestamp = new Date().toISOString();
        
        debugLog.push('=== 超级调试模式 ===');
        debugLog.push(`时间: ${timestamp}`);
        debugLog.push(`音频URL: ${audioUrl}`);
        debugLog.push('');
        
        // 步骤1：检查环境变量
        debugLog.push('【步骤1】检查环境变量');
        const envStatus = {
          IFLYTEK_APP_ID: {
            exists: !!env.IFLYTEK_APP_ID,
            length: env.IFLYTEK_APP_ID ? env.IFLYTEK_APP_ID.length : 0,
            preview: env.IFLYTEK_APP_ID ? env.IFLYTEK_APP_ID.substring(0, 8) + '...' : 'undefined'
          },
          IFLYTEK_API_SECRET: {
            exists: !!env.IFLYTEK_API_SECRET,
            length: env.IFLYTEK_API_SECRET ? env.IFLYTEK_API_SECRET.length : 0,
            preview: env.IFLYTEK_API_SECRET ? env.IFLYTEK_API_SECRET.substring(0, 8) + '...' : 'undefined'
          },
          IFLYTEK_API_KEY: {
            exists: !!env.IFLYTEK_API_KEY,
            length: env.IFLYTEK_API_KEY ? env.IFLYTEK_API_KEY.length : 0,
            preview: env.IFLYTEK_API_KEY ? env.IFLYTEK_API_KEY.substring(0, 8) + '...' : 'undefined'
          }
        };
        debugLog.push(JSON.stringify(envStatus, null, 2));
        debugLog.push('');
        
        // 步骤2：测试音频下载
        debugLog.push('【步骤2】测试音频下载');
        let audioBuffer;
        let audioSize = 0;
        
        try {
          debugLog.push(`正在下载: ${audioUrl}`);
          const startTime = Date.now();
          
          const audioResponse = await fetch(audioUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': '*/*',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              'Referer': 'https://www.douyin.com/'
            }
          });
          
          const downloadTime = Date.now() - startTime;
          debugLog.push(`HTTP状态码: ${audioResponse.status}`);
          debugLog.push(`Content-Type: ${audioResponse.headers.get('content-type')}`);
          debugLog.push(`Content-Length: ${audioResponse.headers.get('content-length')}`);
          debugLog.push(`下载耗时: ${downloadTime}ms`);
          
          if (!audioResponse.ok) {
            throw new Error(`下载失败: ${audioResponse.status} ${audioResponse.statusText}`);
          }
          
          audioBuffer = await audioResponse.arrayBuffer();
          audioSize = audioBuffer.byteLength;
          debugLog.push(`✅ 音频下载成功，大小: ${audioSize} bytes (${(audioSize/1024/1024).toFixed(2)} MB)`);
          
          // 检查音频大小
          if (audioSize > 10 * 1024 * 1024) {
            debugLog.push('⚠️ 警告：音频文件超过10MB，可能会导致问题');
          }
          
        } catch (error) {
          debugLog.push(`❌ 音频下载失败: ${error.message}`);
          debugLog.push(`错误堆栈: ${error.stack}`);
          
          return new Response(JSON.stringify({
            success: false,
            stage: '音频下载',
            debugLog: debugLog.join('\n')
          }, null, 2), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        debugLog.push('');
        
        // 步骤3：音频转Base64
        debugLog.push('【步骤3】音频转Base64');
        let audioBase64;
        
        try {
          const startTime = Date.now();
          audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
          const encodeTime = Date.now() - startTime;
          
          debugLog.push(`✅ Base64编码成功`);
          debugLog.push(`编码后长度: ${audioBase64.length} 字符`);
          debugLog.push(`编码耗时: ${encodeTime}ms`);
          
          // 验证base64
          const testDecode = atob(audioBase64.substring(0, 100));
          debugLog.push(`Base64验证: 通过`);
          
        } catch (error) {
          debugLog.push(`❌ Base64编码失败: ${error.message}`);
          
          // 尝试分块编码
          debugLog.push('尝试分块编码...');
          try {
            const uint8Array = new Uint8Array(audioBuffer);
            let base64 = '';
            const chunkSize = 1024 * 1024; // 1MB chunks
            
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.slice(i, i + chunkSize);
              base64 += btoa(String.fromCharCode(...chunk));
            }
            
            audioBase64 = base64;
            debugLog.push(`✅ 分块编码成功，总长度: ${audioBase64.length}`);
            
          } catch (chunkError) {
            debugLog.push(`❌ 分块编码也失败: ${chunkError.message}`);
            
            return new Response(JSON.stringify({
              success: false,
              stage: 'Base64编码',
              debugLog: debugLog.join('\n')
            }, null, 2), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        
        debugLog.push('');
        
        // 步骤4：调用讯飞API
        debugLog.push('【步骤4】调用讯飞API');
        
        try {
          // 构建请求参数
          const xParam = btoa(JSON.stringify({
            engine_type: 'sms16k',
            aue: 'raw',
            scene: 'main'
          }));
          
          const curTime = Math.floor(Date.now() / 1000).toString();
          
          debugLog.push(`X-Param: ${xParam}`);
          debugLog.push(`X-CurTime: ${curTime}`);
          debugLog.push(`X-Appid: ${env.IFLYTEK_APP_ID}`);
          
          // 计算checkSum
          const checkSumStr = env.IFLYTEK_API_KEY + curTime + xParam;
          debugLog.push(`CheckSum源字符串长度: ${checkSumStr.length}`);
          
          const encoder = new TextEncoder();
          const checkSum = await crypto.subtle.digest(
            'MD5',
            encoder.encode(checkSumStr)
          ).then(hash => 
            Array.from(new Uint8Array(hash))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('')
          );
          
          debugLog.push(`X-CheckSum: ${checkSum}`);
          
          // 构建请求体
          const requestBody = `audio=${encodeURIComponent(audioBase64)}`;
          debugLog.push(`请求体大小: ${requestBody.length} 字符`);
          
          // 发送请求
          const ISE_URL = 'https://api.xfyun.cn/v1/service/v1/iat';
          debugLog.push(`请求URL: ${ISE_URL}`);
          debugLog.push('发送请求...');
          
          const startTime = Date.now();
          const response = await fetch(ISE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
              'X-Appid': env.IFLYTEK_APP_ID,
              'X-CurTime': curTime,
              'X-Param': xParam,
              'X-CheckSum': checkSum
            },
            body: requestBody
          });
          
          const apiTime = Date.now() - startTime;
          debugLog.push(`API响应时间: ${apiTime}ms`);
          debugLog.push(`HTTP状态码: ${response.status}`);
          debugLog.push(`响应Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
          
          const responseText = await response.text();
          debugLog.push(`响应内容: ${responseText}`);
          
          if (!response.ok) {
            throw new Error(`API返回错误状态: ${response.status}`);
          }
          
          // 解析响应
          let result;
          try {
            result = JSON.parse(responseText);
            debugLog.push(`响应解析成功: ${JSON.stringify(result, null, 2)}`);
          } catch (e) {
            throw new Error(`响应不是有效的JSON: ${responseText}`);
          }
          
          if (result.code !== '0') {
            throw new Error(`讯飞API错误: ${result.desc || result.message || '未知错误'}`);
          }
          
          // 提取识别结果
          if (result.data) {
            debugLog.push('✅ 讯飞识别成功！');
            debugLog.push(`识别结果: ${result.data}`);
          } else {
            debugLog.push('⚠️ 讯飞返回成功但没有data字段');
          }
          
        } catch (error) {
          debugLog.push(`❌ 讯飞API调用失败: ${error.message}`);
          debugLog.push(`错误类型: ${error.constructor.name}`);
          debugLog.push(`错误堆栈: ${error.stack}`);
        }
        
        return new Response(JSON.stringify({
          success: true,
          debugLog: debugLog.join('\n')
        }, null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 主处理端点 - 也添加详细日志
      if (path === '/api/process' || path === '/api/process/') {
        const body = await request.json();
        const processLog = [];
        
        try {
          // ... 主处理逻辑，但添加详细日志
          processLog.push(`开始处理: ${new Date().toISOString()}`);
          processLog.push(`抖音链接: ${body.douyinUrl}`);
          
          // 返回处理日志
          return new Response(JSON.stringify({
            success: false,
            message: '请使用 /api/ultra-debug 端点进行深度调试',
            hint: '访问 https://jiaoben-api.keating8500.workers.dev/api/ultra-debug',
            processLog: processLog
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message,
            processLog: processLog
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      return new Response('Ultra Debug Worker', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};