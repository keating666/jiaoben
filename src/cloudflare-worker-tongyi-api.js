/**
 * Cloudflare Worker - 通义千问 API 服务
 * 提供独立的文本生成和脚本改写服务
 */

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check endpoint
      if (path === '/api/tongyi/health' || path === '/health') {
        return new Response(JSON.stringify({
          success: true,
          service: 'Tongyi API Worker',
          timestamp: new Date().toISOString(),
          features: {
            textGeneration: true,
            scriptRewrite: true,
            streaming: false, // Cloudflare Workers don't support SSE well
            configured: !!env.TONGYI_API_KEY
          }
        }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Text Generation Endpoint
      if (path === '/api/tongyi/text-generation') {
        return await handleTextGeneration(request, env, corsHeaders);
      }

      // Script Rewrite Endpoint
      if (path === '/api/tongyi/script-rewrite') {
        return await handleScriptRewrite(request, env, corsHeaders);
      }

      // 404 for unknown paths
      return new Response(JSON.stringify({
        success: false,
        error: 'Endpoint not found'
      }), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

// API Key validation with constant-time comparison
function validateApiKey(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const providedKey = authHeader.substring(7);
  const validKey = env.API_AUTH_KEY || 'default-key';
  
  if (providedKey.length !== validKey.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < providedKey.length; i++) {
    result |= providedKey.charCodeAt(i) ^ validKey.charCodeAt(i);
  }
  
  return result === 0;
}

// Text Generation Handler
async function handleTextGeneration(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Only POST method is allowed'
    }), {
      status: 405,
      headers: corsHeaders
    });
  }

  // Validate API key
  if (!validateApiKey(request, env)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid or missing API key'
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  // Check Tongyi API key configuration
  if (!env.TONGYI_API_KEY) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Tongyi API not configured'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();
    
    // Validate request
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Messages array is required and must not be empty'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate message structure
    for (const message of body.messages) {
      if (!message.role || !message.content) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Each message must have role and content'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      if (!['system', 'user', 'assistant'].includes(message.role)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Message role must be system, user, or assistant'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    // Call Tongyi API
    const tongyiResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.TONGYI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: body.model || 'qwen-max',
        messages: body.messages,
        parameters: {
          max_tokens: body.max_tokens || 1500,
          temperature: body.temperature || 0.7,
          top_p: 0.9,
          top_k: 50,
          repetition_penalty: 1.0,
          stop: body.stop || []
        }
      })
    });

    if (!tongyiResponse.ok) {
      const errorData = await tongyiResponse.text();
      console.error('Tongyi API error:', errorData);
      
      if (tongyiResponse.status === 429) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT'
        }), {
          status: 429,
          headers: corsHeaders
        });
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Tongyi API request failed'
      }), {
        status: tongyiResponse.status,
        headers: corsHeaders
      });
    }

    const tongyiData = await tongyiResponse.json();
    
    // Extract content from response
    const content = tongyiData.output?.text || 
                   tongyiData.output?.choices?.[0]?.message?.content || 
                   '';

    return new Response(JSON.stringify({
      success: true,
      data: {
        content: content,
        usage: tongyiData.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        },
        model: body.model || 'qwen-max'
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Text generation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Text generation failed'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Script Rewrite Handler
async function handleScriptRewrite(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Only POST method is allowed'
    }), {
      status: 405,
      headers: corsHeaders
    });
  }

  // Validate API key
  if (!validateApiKey(request, env)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid or missing API key'
    }), {
      status: 401,
      headers: corsHeaders
    });
  }

  // Check Tongyi API key configuration
  if (!env.TONGYI_API_KEY) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Tongyi API not configured'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }

  try {
    const body = await request.json();
    
    // Validate request
    if (!body.original_script) {
      return new Response(JSON.stringify({
        success: false,
        error: 'original_script is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (!body.style) {
      return new Response(JSON.stringify({
        success: false,
        error: 'style is required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate script size (max 2000 characters)
    if (body.original_script.length > 2000) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Original script exceeds 2000 characters'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate style
    const validStyles = ['humorous', 'educational', 'emotional', 'professional'];
    if (!validStyles.includes(body.style)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Style must be one of: ${validStyles.join(', ')}`
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Style prompts
    const stylePrompts = {
      humorous: "请将这段短视频脚本改写成幽默风趣的风格，加入适当的网络流行语和段子，保持内容核心不变但让人会心一笑。注意保持时长和节奏。",
      educational: "请将这段脚本改写成教育科普风格，确保信息准确、逻辑清晰，用通俗易懂的语言解释复杂概念，适合学习和传播知识。",
      emotional: "请将这段脚本改写成情感丰富的风格，增加感人元素和情感共鸣点，让观众产生情感连接，但避免过度煽情。",
      professional: "请将这段脚本改写成专业正式的风格，使用行业术语和规范表达，体现专业性和权威性，适合商业或正式场合。"
    };

    // Build prompt
    const stylePrompt = stylePrompts[body.style];
    let prompt = `${stylePrompt}\n\n原始脚本：\n${body.original_script}\n\n`;
    
    if (body.target_length) {
      prompt += `目标长度：约${body.target_length}字\n`;
    } else {
      prompt += `目标长度：与原始脚本相近\n`;
    }
    
    if (body.additional_requirements) {
      prompt += `额外要求：${body.additional_requirements}\n`;
    }
    
    prompt += '\n请提供改写后的脚本，并在最后简要说明主要改动。';

    // Call Tongyi API
    const startTime = Date.now();
    const tongyiResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.TONGYI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-max',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的视频脚本改写专家，擅长根据不同风格要求改写脚本。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        parameters: {
          max_tokens: 2000,
          temperature: 0.8,
          top_p: 0.9,
          top_k: 50
        }
      })
    });

    if (!tongyiResponse.ok) {
      const errorData = await tongyiResponse.text();
      console.error('Tongyi API error:', errorData);
      
      if (tongyiResponse.status === 429) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT'
        }), {
          status: 429,
          headers: corsHeaders
        });
      }
      
      // Retry with fallback model on service overload
      if (tongyiResponse.status === 503) {
        console.log('Service overload, retrying with qwen-plus...');
        
        const retryResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.TONGYI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'qwen-plus', // Fallback to lighter model
            messages: [
              {
                role: 'system',
                content: '你是一位专业的视频脚本改写专家。'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            parameters: {
              max_tokens: 1500,
              temperature: 0.7
            }
          })
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const result = extractRewriteResult(retryData.output?.text || '');
          
          return new Response(JSON.stringify({
            success: true,
            data: {
              rewritten_script: result.script,
              style_applied: body.style,
              character_count: result.script.length,
              changes_summary: result.summary + ' (使用备用模型)',
              processing_time: Date.now() - startTime
            }
          }), {
            status: 200,
            headers: corsHeaders
          });
        }
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Tongyi API request failed'
      }), {
        status: tongyiResponse.status,
        headers: corsHeaders
      });
    }

    const tongyiData = await tongyiResponse.json();
    const processingTime = Date.now() - startTime;
    
    // Extract content from response
    const generatedText = tongyiData.output?.text || 
                         tongyiData.output?.choices?.[0]?.message?.content || 
                         '';
    
    // Extract script and summary
    const result = extractRewriteResult(generatedText);

    return new Response(JSON.stringify({
      success: true,
      data: {
        rewritten_script: result.script,
        style_applied: body.style,
        character_count: result.script.length,
        changes_summary: result.summary,
        processing_time: processingTime
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Script rewrite error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Script rewrite failed'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Helper function to extract script and summary from generated text
function extractRewriteResult(generatedText) {
  // Try to extract script and summary from the generated text
  const parts = generatedText.split(/主要改动[:：]|改动说明[:：]/i);
  
  if (parts.length >= 2) {
    return {
      script: parts[0].trim(),
      summary: parts[1].trim()
    };
  }
  
  // If no clear separation, return the whole text as script
  return {
    script: generatedText.trim(),
    summary: '已根据要求完成脚本改写'
  };
}