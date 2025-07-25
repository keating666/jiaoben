import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  console.log('=== Test Transcribe API Started ===');
  
  try {
    // 步骤1：检查请求方法
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // 步骤2：解析请求体
    const { mixedText } = req.body;
    console.log('Received mixedText:', mixedText?.substring(0, 50));

    // 步骤3：尝试导入 SecurityValidator
    try {
      const { SecurityValidator } = await import('../tech-validation/utils/security-validator');
      console.log('SecurityValidator imported successfully');
      
      // 测试 SecurityValidator
      const sanitized = SecurityValidator.sanitizeForLogging(mixedText || '');
      console.log('Sanitized text:', sanitized);
    } catch (error) {
      console.error('Failed to import SecurityValidator:', error);
      throw new Error(`SecurityValidator import failed: ${error}`);
    }

    // 步骤4：尝试导入 DouyinLinkExtractor
    try {
      const { DouyinLinkExtractor } = await import('../tech-validation/utils/douyin-link-extractor');
      console.log('DouyinLinkExtractor imported successfully');
      
      // 测试链接提取
      if (mixedText) {
        const extracted = DouyinLinkExtractor.extractDouyinLink(mixedText);
        console.log('Extracted link:', extracted);
      }
    } catch (error) {
      console.error('Failed to import DouyinLinkExtractor:', error);
      throw new Error(`DouyinLinkExtractor import failed: ${error}`);
    }

    // 步骤5：尝试导入 LinkExtractor
    try {
      const { LinkExtractor } = await import('../tech-validation/utils/link-extractor');
      console.log('LinkExtractor imported successfully');
    } catch (error) {
      console.error('Failed to import LinkExtractor:', error);
      throw new Error(`LinkExtractor import failed: ${error}`);
    }

    // 如果所有导入都成功
    res.status(200).json({
      success: true,
      message: 'All imports successful',
      test: {
        mixedTextReceived: !!mixedText,
        mixedTextLength: mixedText?.length || 0,
      },
    });

  } catch (error) {
    console.error('Test API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error : undefined,
    });
  }
}