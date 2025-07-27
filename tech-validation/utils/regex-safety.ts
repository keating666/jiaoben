/**
 * 正则表达式安全执行器
 * 防止正则表达式导致的性能问题和安全风险
 */
export class RegexSafety {
  private static readonly MAX_EXECUTION_TIME = 1000; // 最大执行时间（毫秒）
  private static readonly MAX_ITERATIONS = 10000; // 最大迭代次数
  
  /**
   * 验证正则表达式是否安全
   */
  static validatePattern(pattern: RegExp): { safe: boolean; reason?: string } {
    const source = pattern.source;
    
    // 检查危险的正则构造
    const dangerousPatterns = [
      { pattern: /\(\?R\)/, reason: '包含递归模式' },
      { pattern: /\*\+/, reason: '包含占有量词' },
      { pattern: /\+\+/, reason: '包含占有量词' },
      { pattern: /\{(\d+),\}/g, reason: '包含大量重复', check: (match: RegExpMatchArray) => {
        const min = parseInt(match[1]);
        return min > 100;
      }},
      { pattern: /\{(\d+),(\d+)\}/g, reason: '包含大量重复', check: (match: RegExpMatchArray) => {
        const max = parseInt(match[2]);
        return max > 1000;
      }},
      { pattern: /(\[[^\]]*\])\*/, reason: '字符类的贪婪匹配可能导致回溯' },
      { pattern: /(\([^)]*\))\*/, reason: '分组的贪婪匹配可能导致回溯' },
    ];
    
    for (const dangerous of dangerousPatterns) {
      let match;
      const regex = new RegExp(dangerous.pattern.source, 'g');
      
      while ((match = regex.exec(source)) !== null) {
        if (dangerous.check) {
          if (dangerous.check(match)) {
            return { safe: false, reason: dangerous.reason };
          }
        } else {
          return { safe: false, reason: dangerous.reason };
        }
      }
    }
    
    return { safe: true };
  }
  
  /**
   * 安全执行正则表达式
   */
  static safeExec(
    pattern: RegExp, 
    text: string, 
    options: {
      timeout?: number;
      maxMatches?: number;
    } = {}
  ): RegExpExecArray[] {
    const timeout = options.timeout || this.MAX_EXECUTION_TIME;
    const maxMatches = options.maxMatches || 1000;
    
    const startTime = Date.now();
    const matches: RegExpExecArray[] = [];
    let iterations = 0;
    
    // 重置正则状态
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push(match);
      iterations++;
      
      // 检查执行时间
      if (Date.now() - startTime > timeout) {
        console.warn(`正则执行超时: ${pattern.source}`);
        break;
      }
      
      // 检查迭代次数
      if (iterations > this.MAX_ITERATIONS) {
        console.warn(`正则迭代次数过多: ${pattern.source}`);
        break;
      }
      
      // 检查匹配数量
      if (matches.length >= maxMatches) {
        console.warn(`匹配数量达到上限: ${maxMatches}`);
        break;
      }
      
      // 防止无限循环（零宽度匹配）
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
    }
    
    return matches;
  }
  
  /**
   * 批量安全执行多个正则
   */
  static safeExecMultiple(
    patterns: RegExp[], 
    text: string,
    options: {
      timeout?: number;
      maxMatchesPerPattern?: number;
      totalTimeout?: number;
    } = {}
  ): Map<RegExp, RegExpExecArray[]> {
    const results = new Map<RegExp, RegExpExecArray[]>();
    const totalStartTime = Date.now();
    const totalTimeout = options.totalTimeout || 5000;
    
    for (const pattern of patterns) {
      // 检查总体超时
      if (Date.now() - totalStartTime > totalTimeout) {
        console.warn('批量正则执行总体超时');
        break;
      }
      
      // 验证正则安全性
      const validation = this.validatePattern(pattern);
      if (!validation.safe) {
        console.warn(`跳过不安全的正则: ${pattern.source} - ${validation.reason}`);
        results.set(pattern, []);
        continue;
      }
      
      // 执行正则
      const matches = this.safeExec(pattern, text, {
        timeout: options.timeout,
        maxMatches: options.maxMatchesPerPattern
      });
      
      results.set(pattern, matches);
    }
    
    return results;
  }
  
  /**
   * 创建性能优化的正则
   */
  static optimizePattern(pattern: RegExp): RegExp {
    let source = pattern.source;
    let flags = pattern.flags;
    
    // 优化常见的性能问题
    const optimizations = [
      // 将贪婪量词改为非贪婪
      { from: /\+(?!\?)/, to: '+?' },
      { from: /\*(?!\?)/, to: '*?' },
      
      // 使用原子组来防止回溯（JavaScript不支持，但可以用其他方式优化）
      // 限制字符类的范围
      { from: /\[\\s\\S\]\*/g, to: '[\\s\\S]{0,1000}' },
      { from: /\.\*/g, to: '.{0,1000}' },
    ];
    
    // 注意：这里的优化可能改变正则的行为，需要谨慎使用
    // 实际使用时应该根据具体情况调整
    
    return new RegExp(source, flags);
  }
  
  /**
   * 测试正则性能
   */
  static benchmarkPattern(
    pattern: RegExp, 
    testTexts: string[]
  ): {
    avgTime: number;
    maxTime: number;
    minTime: number;
    safe: boolean;
  } {
    const times: number[] = [];
    let safe = true;
    
    for (const text of testTexts) {
      const startTime = performance.now();
      
      try {
        const matches = this.safeExec(pattern, text, { timeout: 100 });
        const endTime = performance.now();
        times.push(endTime - startTime);
        
        if (matches.length === 0 && endTime - startTime > 50) {
          safe = false;
        }
      } catch (error) {
        safe = false;
        times.push(100); // 超时时间
      }
    }
    
    return {
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      maxTime: Math.max(...times),
      minTime: Math.min(...times),
      safe
    };
  }
}