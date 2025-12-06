import { logger } from './logger';
import { RegexSafety } from './regex-safety';
import { EnhancedDouyinExtractor, ExtractedLink, DouyinCommand, EnhancedExtractResult } from './enhanced-douyin-extractor';

/**
 * 健壮版抖音链接提取器
 * 增强了安全性、性能和错误处理
 */
export class RobustDouyinExtractor extends EnhancedDouyinExtractor {
  // 输入限制
  private static readonly MAX_TEXT_LENGTH = 50000;
  private static readonly MAX_LINKS = 100;
  private static readonly MAX_COMMANDS = 100;
  private static readonly CHUNK_SIZE = 5000;
  
  // 优化后的URL模式（添加了长度限制）
  private static readonly ROBUST_URL_PATTERNS = [
    // 短链接（限制ID长度）
    /https?:\/\/v\.douyin\.com\/[\w\d]{1,20}\/?/gi,
    
    // 完整视频链接（限制ID长度）
    /https?:\/\/www\.douyin\.com\/video\/\d{15,20}\/?/gi,
    
    // 分享链接
    /https?:\/\/www\.iesdouyin\.com\/share\/video\/\d{15,20}\/?/gi,
    
    // 用户主页（限制用户ID长度）
    /https?:\/\/www\.douyin\.com\/user\/[\w-]{1,50}\/?/gi,
    
    // 话题链接
    /https?:\/\/www\.douyin\.com\/hashtag\/\d{1,20}\/?/gi,
    
    // 直播链接
    /https?:\/\/live\.douyin\.com\/\d{1,20}\/?/gi,
    /https?:\/\/webcast\.amemv\.com\/douyin\/webcast\/reflow\/\w{1,50}/gi,
    
    // 抖音极速版
    /https?:\/\/v\.douyinvod\.com\/[\w\d]{1,20}\/?/gi,
    
    // TikTok
    /https?:\/\/vm\.tiktok\.com\/[\w\d]{1,20}\/?/gi,
  ];
  
  // 优化后的口令模式（添加了边界检查）
  private static readonly ROBUST_COMMAND_PATTERNS = [
    // 话题标签（限制长度）
    /[#＃]{1}[^#＃]{1,100}[#＃]{1}/g,
    
    // 数字代码格式（更严格的匹配）
    /\b[\d.]{1,5}\s+[\w:/]{1,20}\s*复制此链接/g,
    /\b[\d.]{1,5}\s+[\w:/]{1,20}\s*复制打开抖音/g,
    /\b[\d.]{1,5}\s+[\w:/]{1,20}\s*打开Dou音/g,
    /\b[\d.]{1,5}\s+[\w:/]{1,20}\s*打开抖音/g,
    
    // 淘口令格式（限制长度）
    /[￥¥$]{1}[\w\d]{1,30}[￥¥$]{1}/g,
    
    // 新版口令
    /%%[\w\d\u4e00-\u9fa5]{1,50}%%/g,
    
    // dOU口令
    /dOU口令[:]?\s*[\w\d]{1,30}/g,
    
    // 分享码
    /分享码[:]?\s*[\w\d]{1,30}/g,
    /邀请码[:]?\s*[\w\d]{1,30}/g,
  ];
  
  /**
   * 安全的智能提取（主入口）
   */
  static async smartExtract(text: string): Promise<EnhancedExtractResult> {
    try {
      // 1. 输入验证
      this.validateInput(text);
      
      // 2. 预处理文本
      const processedText = this.preprocessText(text);
      
      // 3. 根据文本长度选择处理策略
      if (processedText.length > this.CHUNK_SIZE) {
        return await this.extractInChunks(processedText);
      }
      
      // 4. 执行提取
      return await this.robustExtract(processedText);
    } catch (error) {
      logger.error('RobustDouyinExtractor', 'smartExtract', '提取失败', error as Error);
      
      // 返回安全的默认结果
      return {
        links: [],
        commands: [],
        confidence: 0,
        method: 'regex',
        suggestions: ['提取过程中出现错误，请检查输入内容'],
      };
    }
  }
  
  /**
   * 输入验证
   */
  private static validateInput(text: string): void {
    if (!text || typeof text !== 'string') {
      throw new Error('输入必须是非空字符串');
    }

    if (text.length > this.MAX_TEXT_LENGTH) {
      throw new Error(`输入文本过长，最大支持 ${this.MAX_TEXT_LENGTH} 字符`);
    }

    // 检查是否包含控制字符（可能是恶意输入）
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
      throw new Error('输入包含非法控制字符');
    }
  }
  
  /**
   * 预处理文本
   */
  private static preprocessText(text: string): string {
    // 规范化空白字符
    let processed = text.replace(/\s+/g, ' ').trim();
    
    // 移除零宽字符
    processed = processed.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // 规范化引号
    processed = processed
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'");
    
    return processed;
  }
  
  /**
   * 分块处理长文本
   */
  private static async extractInChunks(text: string): Promise<EnhancedExtractResult> {
    const chunks: string[] = [];
    const overlap = 200; // 重叠部分，避免截断链接
    
    // 创建重叠的文本块
    for (let i = 0; i < text.length; i += this.CHUNK_SIZE - overlap) {
      chunks.push(text.slice(i, i + this.CHUNK_SIZE));
    }
    
    // 并行处理各个块
    const chunkResults = await Promise.all(
      chunks.map((chunk) => this.robustExtract(chunk)),
    );
    
    // 合并结果
    return this.mergeResults(chunkResults);
  }
  
  /**
   * 健壮的提取实现
   */
  private static async robustExtract(text: string): Promise<EnhancedExtractResult> {
    const links: ExtractedLink[] = [];
    const commands: DouyinCommand[] = [];
    const processedUrls = new Set<string>();
    const processedCommands = new Set<string>();
    
    // 1. 提取链接（使用安全执行器）
    const linkResults = RegexSafety.safeExecMultiple(
      this.ROBUST_URL_PATTERNS,
      text,
      {
        timeout: 100,
        maxMatchesPerPattern: this.MAX_LINKS,
        totalTimeout: 1000,
      },
    );
    
    // 处理链接结果
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_pattern, matches] of linkResults) {
      for (const match of matches) {
        if (links.length >= this.MAX_LINKS) {break;}

        const cleanUrl = this.robustCleanUrl(match[0], text, match.index);

        if (cleanUrl && !processedUrls.has(cleanUrl)) {
          processedUrls.add(cleanUrl);
          links.push({
            url: cleanUrl,
            platform: 'douyin',
            originalText: text,
            type: this.detectLinkType(cleanUrl),
            position: match.index,
          });
        }
      }
    }

    // 2. 提取口令（使用安全执行器）
    const commandResults = RegexSafety.safeExecMultiple(
      this.ROBUST_COMMAND_PATTERNS,
      text,
      {
        timeout: 100,
        maxMatchesPerPattern: this.MAX_COMMANDS,
        totalTimeout: 1000,
      },
    );

    // 处理口令结果
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_pattern, matches] of commandResults) {
      for (const match of matches) {
        if (commands.length >= this.MAX_COMMANDS) {break;}
        
        const content = this.extractCommandContent(match[0]);

        if (content && !processedCommands.has(content)) {
          processedCommands.add(content);
          commands.push({
            type: this.detectCommandType(match[0]),
            content,
            fullText: match[0],
            position: match.index,
          });
        }
      }
    }
    
    // 3. 计算结果
    const confidence = this.calculateConfidence(links, commands, text);
    const suggestions = this.generateSuggestions(links, commands, text);
    const method = this.determineMethod(links, commands);
    
    return {
      links: links.slice(0, this.MAX_LINKS),
      commands: commands.slice(0, this.MAX_COMMANDS),
      confidence,
      method,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  }
  
  /**
   * 健壮的URL清理
   */
  private static robustCleanUrl(url: string, fullText: string, position: number): string | null {
    try {
      let cleaned = url.trim();
      
      // 长度检查
      if (cleaned.length > 500) {
        return null;
      }
      
      // 智能截断
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _afterUrl = fullText.substring(position + url.length, position + url.length + 10);
      const cutoffMatch = cleaned.match(/^(https?:\/\/[^\s\u4e00-\u9fa5，。！？、）)》】]{1,200})/);

      if (cutoffMatch) {
        cleaned = cutoffMatch[1];
      }
      
      // 使用Unicode属性移除尾部标点
      cleaned = cleaned.replace(/[\p{P}\s]+$/u, '');
      
      // 清理追踪参数
      cleaned = this.cleanTrackingParams(cleaned);
      
      // 确保协议
      if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        cleaned = `https://${cleaned}`;
      }
      
      // 验证URL格式
      try {
        const urlObj = new URL(cleaned);
        // 检查是否是抖音域名
        const validDomains = [
          'douyin.com', 'douyinvod.com', 'iesdouyin.com', 
          'amemv.com', 'tiktok.com',
        ];
        const hostname = urlObj.hostname.toLowerCase();
        const isValid = validDomains.some((domain) => 
          hostname.endsWith(domain) || hostname.endsWith(`.${domain}`),
        );
        
        if (!isValid) {
          return null;
        }
        
        return cleaned;
      } catch {
        return null;
      }
    } catch (error) {
      logger.warn('RobustDouyinExtractor', 'robustCleanUrl', 'URL清理失败', { url });

      return null;
    }
  }
  
  /**
   * 合并多个提取结果
   */
  private static mergeResults(results: EnhancedExtractResult[]): EnhancedExtractResult {
    const allLinks: ExtractedLink[] = [];
    const allCommands: DouyinCommand[] = [];
    const linkSet = new Set<string>();
    const commandSet = new Set<string>();
    
    // 合并链接（去重）
    for (const result of results) {
      for (const link of result.links) {
        if (!linkSet.has(link.url)) {
          linkSet.add(link.url);
          allLinks.push(link);
        }
      }
    }
    
    // 合并口令（去重）
    for (const result of results) {
      for (const command of result.commands) {
        const key = `${command.type}:${command.content}`;

        if (!commandSet.has(key)) {
          commandSet.add(key);
          allCommands.push(command);
        }
      }
    }
    
    // 计算平均置信度
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    // 合并建议
    const allSuggestions = results
      .flatMap((r) => r.suggestions || [])
      .filter((v, i, a) => a.indexOf(v) === i); // 去重
    
    return {
      links: allLinks.slice(0, this.MAX_LINKS),
      commands: allCommands.slice(0, this.MAX_COMMANDS),
      confidence: avgConfidence,
      method: allLinks.length > 0 && allCommands.length > 0 ? 'mixed' : 
              allLinks.length > 0 ? 'regex' : 'command',
      suggestions: allSuggestions.length > 0 ? allSuggestions : undefined,
    };
  }
  
  /**
   * 性能测试
   */
  static async benchmark(): Promise<void> {
    const testCases = [
      { name: '短文本', text: 'https://v.douyin.com/test/' },
      { name: '中等文本', text: `${'a'.repeat(1000)  }https://v.douyin.com/test/` },
      { name: '长文本', text: `${'a'.repeat(10000)  }https://v.douyin.com/test/` },
      { name: '多链接', text: Array(50).fill('https://v.douyin.com/test/').join(' ') },
      { name: '复杂口令', text: Array(50).fill('#测试话题#').join(' ') },
    ];
    
    console.log('=== 性能测试 ===');
    
    for (const testCase of testCases) {
      const start = performance.now();
      const result = await this.smartExtract(testCase.text);
      const end = performance.now();
      
      console.log(`${testCase.name}: ${(end - start).toFixed(2)}ms`);
      console.log(`  链接: ${result.links.length}, 口令: ${result.commands.length}`);
    }
  }
}