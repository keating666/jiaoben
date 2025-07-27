import { VercelRequest, VercelResponse } from '@vercel/node';
import { RobustDouyinExtractor } from '../../tech-validation/utils/robust-douyin-extractor';

/**
 * API端点：从文本中提取抖音链接
 * POST /api/video/extract-douyin-url
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // 只接受POST请求
  if (req.method !== 'POST') {
    res.status(405).json({ 
      success: false, 
      error: '只支持POST请求' 
    });
    return;
  }

  try {
    const { text } = req.body;

    // 参数验证
    if (!text || typeof text !== 'string') {
      res.status(400).json({
        success: false,
        error: '请提供要提取链接的文本'
      });
      return;
    }

    // 文本长度限制（防止滥用）
    if (text.length > 10000) {
      res.status(400).json({
        success: false,
        error: '文本长度不能超过10000字符'
      });
      return;
    }

    // 使用健壮版提取器（增强了安全性和性能）
    const result = await RobustDouyinExtractor.smartExtract(text);

    // 构建响应
    const response = {
      success: true,
      data: {
        // 主要结果
        links: result.links.map(link => ({
          url: link.url,
          type: link.type || 'unknown',
          position: link.position
        })),
        
        // 口令信息
        commands: result.commands.map(cmd => ({
          type: cmd.type,
          content: cmd.content,
          fullText: cmd.fullText
        })),
        
        // 元信息
        meta: {
          method: result.method,
          confidence: result.confidence,
          linkCount: result.links.length,
          commandCount: result.commands.length
        },
        
        // 建议（如果有）
        suggestions: result.suggestions || []
      }
    };

    // 如果没有找到任何内容，返回友好提示
    if (result.links.length === 0 && result.commands.length === 0) {
      response.data.meta.message = '未找到抖音相关内容';
      
      // 添加帮助信息
      if (!result.suggestions || result.suggestions.length === 0) {
        response.data.suggestions = [
          '请确保文本中包含完整的抖音分享链接',
          '抖音链接通常以 https://v.douyin.com/ 开头',
          '也可以粘贴抖音APP中的分享文本或口令'
        ];
      }
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('提取抖音链接失败:', error);
    
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
}

// API文档
export const apiDoc = {
  endpoint: '/api/video/extract-douyin-url',
  method: 'POST',
  description: '从文本中智能提取抖音链接和口令',
  
  request: {
    body: {
      text: 'string (required) - 包含抖音链接的文本，最长10000字符'
    }
  },
  
  response: {
    success: {
      links: [
        {
          url: 'string - 清理和规范化后的链接',
          type: 'string - 链接类型 (video|user|live|short|unknown)',
          position: 'number - 在原文中的位置'
        }
      ],
      commands: [
        {
          type: 'string - 口令类型 (command|copy-text|search)',
          content: 'string - 口令内容',
          fullText: 'string - 完整口令文本'
        }
      ],
      meta: {
        method: 'string - 提取方法 (regex|command|mixed)',
        confidence: 'number - 置信度 (0-1)',
        linkCount: 'number - 链接数量',
        commandCount: 'number - 口令数量',
        message: 'string (optional) - 额外信息'
      },
      suggestions: ['string - 建议和提示']
    }
  },
  
  examples: [
    {
      name: '标准链接',
      request: {
        text: '看这个视频 https://v.douyin.com/iRyLb8kf/ 很有趣'
      },
      response: {
        success: true,
        data: {
          links: [{
            url: 'https://v.douyin.com/iRyLb8kf',
            type: 'short',
            position: 7
          }],
          commands: [],
          meta: {
            method: 'regex',
            confidence: 0.95,
            linkCount: 1,
            commandCount: 0
          },
          suggestions: []
        }
      }
    },
    
    {
      name: '抖音口令',
      request: {
        text: '7.53 MQc:/ 复制此链接，打开抖音'
      },
      response: {
        success: true,
        data: {
          links: [],
          commands: [{
            type: 'copy-text',
            content: 'MQc:/',
            fullText: '7.53 MQc:/ 复制此链接'
          }],
          meta: {
            method: 'command',
            confidence: 0.7,
            linkCount: 0,
            commandCount: 1
          },
          suggestions: ['检测到抖音口令，请在抖音APP中打开']
        }
      }
    }
  ]
};