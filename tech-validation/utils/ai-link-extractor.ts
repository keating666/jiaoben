import { logger } from './logger';
import { TongyiTextGenerator } from '../interfaces/tongyi-text-generator';
import { ExtractedLink } from './link-extractor';

export class AILinkExtractor {
  private tongyiClient: TongyiTextGenerator;

  constructor() {
    this.tongyiClient = new TongyiTextGenerator();
  }

  /**
   * 使用通义千问 AI 提取视频链接
   */
  async extractVideoLink(mixedText: string): Promise<ExtractedLink | null> {
    try {
      logger.info('AILinkExtractor', 'extractVideoLink', '使用 AI 提取视频链接');

      const prompt = `请从以下文本中提取视频链接。只需要返回JSON格式的结果，不要有其他说明。

文本内容：
${mixedText}

要求：
1. 找出文本中的视频链接（支持抖音、YouTube、TikTok等）
2. 识别链接所属平台
3. 返回JSON格式：{"url": "提取的链接", "platform": "平台名称"}
4. 平台名称使用：douyin（抖音）、youtube、tiktok、other（其他）
5. 如果没有找到链接，返回：{"url": null, "platform": null}
6. 只返回JSON，不要有其他文字说明`;

      const result = await this.tongyiClient.generateContent(prompt);
      
      // 尝试解析 AI 返回的 JSON
      try {
        // 提取 JSON 部分（AI 可能会返回额外的文字）
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          logger.warn('AILinkExtractor', 'extractVideoLink', 'AI 返回结果中未找到 JSON');
          return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        
        if (!parsed.url || parsed.url === null) {
          logger.info('AILinkExtractor', 'extractVideoLink', 'AI 未找到视频链接');
          return null;
        }

        logger.info('AILinkExtractor', 'extractVideoLink', 'AI 成功提取链接', { 
          url: parsed.url, 
          platform: parsed.platform 
        });

        return {
          url: parsed.url,
          platform: parsed.platform || 'other',
          originalText: mixedText,
        };
      } catch (parseError) {
        logger.error('AILinkExtractor', 'extractVideoLink', '解析 AI 返回的 JSON 失败', parseError);
        
        // 尝试用正则提取 URL
        const urlMatch = result.match(/https?:\/\/[^\s"']+/);
        if (urlMatch) {
          return {
            url: urlMatch[0],
            platform: 'other',
            originalText: mixedText,
          };
        }
        
        return null;
      }
    } catch (error) {
      logger.error('AILinkExtractor', 'extractVideoLink', 'AI 链接提取失败', error);
      return null;
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    await this.tongyiClient.dispose();
  }
}