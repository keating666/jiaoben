/**
 * Cloudflare Worker - 演示模式（使用模拟数据）
 * 当 TikHub API 不可用时的备用方案
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
    const path = url.pathname;
    
    try {
      // 测试端点
      if (path === '/api/test' || path === '/api/test/') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Worker正常运行 - 演示模式',
          timestamp: new Date().toISOString(),
          demoMode: true,
          features: {
            linkCleaning: true,
            realASR: false,
            aiGeneration: true,
            tikhub: false
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 主处理端点
      if (path === '/api/process' || path === '/api/process/') {
        if (request.method !== 'POST') {
          return new Response(JSON.stringify({
            error: 'Method not allowed'
          }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const body = await request.json();
        const rawUrl = body.douyinUrl;
        
        if (!rawUrl) {
          return new Response(JSON.stringify({
            success: false,
            error: '请提供抖音链接'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // 步骤1：清洗链接
        const cleanedUrl = cleanDouyinUrl(rawUrl);
        console.log('清洗后链接:', cleanedUrl);
        
        // 演示模式：使用模拟数据
        const demoVideoInfo = {
          title: "AI驱动的视频内容创作新时代",
          author: "科技前沿观察",
          duration: 180,
          statistics: {
            play: "2.5万",
            like: "1.2万",
            comment: "368",
            share: "892"
          }
        };
        
        // 模拟转写内容
        const demoTranscript = `
大家好，欢迎来到科技前沿观察。今天我们要聊一个特别火的话题，就是人工智能如何改变视频内容创作。

首先，让我们看看传统的视频制作流程。通常需要编剧写脚本，导演设计镜头，后期剪辑配音，整个过程可能需要几天甚至几周。

但是现在，有了AI的加持，这个过程被大大简化了。AI可以自动生成脚本，推荐最佳的镜头组合，甚至可以自动配音和添加字幕。

比如说，我们正在使用的这个系统，它可以自动分析视频内容，提取关键信息，然后生成专业的分镜脚本。这在以前是不可想象的。

更厉害的是，AI还能学习不同风格的创作手法。无论你想要科技感十足的，还是温馨感人的，又或者是搞笑幽默的，AI都能帮你实现。

当然，这并不是说AI要取代人类创作者。相反，AI是创作者最好的助手，让创作者能够把更多精力放在创意本身，而不是繁琐的技术细节上。

未来，我相信AI和人类创作者的结合，会创造出更多精彩的内容。让我们一起期待这个美好的未来吧！

感谢大家的观看，如果你对AI创作感兴趣，记得关注我们，下期再见！
        `.trim();
        
        // 生成分镜脚本
        const demoScript = [
          {
            scene: "场景1：开场介绍",
            time: "00:00-00:15",
            visual: "主播正面出镜，背景是科技感十足的虚拟演播室",
            camera: "中景固定镜头",
            dialogue: "大家好，欢迎来到科技前沿观察。今天我们要聊一个特别火的话题..."
          },
          {
            scene: "场景2：传统流程展示",
            time: "00:15-00:35",
            visual: "分屏展示传统视频制作的各个环节：编剧、拍摄、剪辑",
            camera: "动态分屏效果，配合流程图动画",
            dialogue: "首先，让我们看看传统的视频制作流程..."
          },
          {
            scene: "场景3：AI工具演示",
            time: "00:35-01:00",
            visual: "展示AI工具界面，实时生成内容的过程",
            camera: "屏幕录制，配合局部放大特效",
            dialogue: "但是现在，有了AI的加持，这个过程被大大简化了..."
          },
          {
            scene: "场景4：实际案例",
            time: "01:00-01:30",
            visual: "展示使用AI创作的实际视频案例对比",
            camera: "画中画效果，展示前后对比",
            dialogue: "比如说，我们正在使用的这个系统..."
          },
          {
            scene: "场景5：功能亮点",
            time: "01:30-02:00",
            visual: "动画展示AI的各种创作风格：科技、温馨、幽默",
            camera: "快速切换不同风格的示例片段",
            dialogue: "更厉害的是，AI还能学习不同风格的创作手法..."
          },
          {
            scene: "场景6：未来展望",
            time: "02:00-02:30",
            visual: "主播回到演播室，背景展示未来科技场景",
            camera: "中景推进到特写",
            dialogue: "当然，这并不是说AI要取代人类创作者..."
          },
          {
            scene: "场景7：结尾呼吁",
            time: "02:30-03:00",
            visual: "展示频道信息和关注按钮，配合动态特效",
            camera: "全景拉远，logo定格",
            dialogue: "感谢大家的观看，如果你对AI创作感兴趣..."
          }
        ];
        
        // 返回成功结果
        return new Response(JSON.stringify({
          success: true,
          demoMode: true,
          cleanedUrl: cleanedUrl,
          videoInfo: demoVideoInfo,
          transcript: demoTranscript,
          asrUsed: false,
          script: demoScript,
          message: "演示模式：使用模拟数据展示功能"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // 404
      return new Response(JSON.stringify({
        error: 'Not found',
        availableEndpoints: ['/api/test', '/api/process']
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// 链接清洗函数
function cleanDouyinUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  
  // 移除空白字符
  url = url.trim();
  
  // 处理各种抖音链接格式
  const patterns = [
    // 短链接：支持包含下划线、连字符等特殊字符
    /https?:\/\/v\.douyin\.com\/[A-Za-z0-9_\-]+/,
    // 完整链接
    /https?:\/\/www\.douyin\.com\/video\/\d+/,
    /https?:\/\/www\.douyin\.com\/discover\?modal_id=\d+/,
    // 移动端链接
    /https?:\/\/m\.douyin\.com\/share\/video\/\d+/,
    // 带参数的链接
    /https?:\/\/[^\/]*douyin\.com\/[^\s?]*/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      let cleanUrl = match[0];
      
      // 移除尾部的特殊字符（但保留下划线和连字符）
      cleanUrl = cleanUrl.replace(/[^\w\/:._-]+$/, '');
      
      // 确保短链接有斜杠结尾
      if (cleanUrl.includes('v.douyin.com') && !cleanUrl.endsWith('/')) {
        cleanUrl += '/';
      }
      
      console.log('链接清洗成功:', url, '->', cleanUrl);
      return cleanUrl;
    }
  }
  
  // 如果没有匹配到，返回原链接
  console.log('链接格式未识别，返回原链接');
  return url;
}