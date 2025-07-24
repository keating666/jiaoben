/**
 * 安全验证工具 - 提供增强的输入验证和安全检查
 */

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export class SecurityValidator {
  // URL最大长度限制
  private static readonly URL_MAX_LENGTH = 2048;
  
  // API Token 最小长度
  private static readonly API_TOKEN_MIN_LENGTH = 32;
  
  // 被阻止的主机名列表（云服务元数据端点）
  private static readonly BLOCKED_HOSTS = [
    '169.254.169.254',              // AWS/Azure/GCP metadata
    'metadata.google.internal',      // GCP metadata
    'metadata.azure.com',           // Azure metadata
    'kube-dns.kube-system.svc.cluster.local', // Kubernetes DNS
    'kubernetes.default.svc.cluster.local'     // Kubernetes API
  ];
  
  // 内网地址正则表达式
  private static readonly PRIVATE_IP_PATTERNS = [
    /^localhost$/i,
    /^127\./,                       // 127.0.0.0/8
    /^10\./,                        // 10.0.0.0/8
    /^192\.168\./,                  // 192.168.0.0/16
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^169\.254\./,                  // 169.254.0.0/16 Link-local
    /^::1$/,                        // IPv6 localhost
    /^fe80::/i,                     // IPv6 link-local
    /^fc00::/i,                     // IPv6 private
    /^fd[0-9a-f]{2}:/i,            // IPv6 unique local
    /\.local$/i,                    // mDNS
    /\.internal$/i,                 // Internal domains
    /\.intranet$/i,                 // Intranet domains
    /\.corp$/i,                     // Corporate domains
    /\.home$/i                      // Home network domains
  ];
  
  /**
   * 验证视频URL的安全性和有效性
   */
  static validateVideoUrl(url: string): ValidationResult {
    // 长度检查
    if (url.length > this.URL_MAX_LENGTH) {
      return { valid: false, reason: `URL长度超过${this.URL_MAX_LENGTH}字符限制` };
    }
    
    // URL解析
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return { valid: false, reason: 'URL格式无效' };
    }
    
    // 协议检查
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, reason: '仅支持 HTTP/HTTPS 协议' };
    }
    
    // 获取主机名并移除 IPv6 的方括号
    let hostname = parsedUrl.hostname.toLowerCase();
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }
    
    // 检查是否为IP地址
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    // IPv6 检查（包括简化形式如 ::1）
    const isIPv6 = hostname.includes(':') || hostname === '::1';
    
    // 特殊IP地址检查
    if (isIPv4) {
      const parts = hostname.split('.').map(Number);
      
      // 检查每个部分是否在有效范围内
      if (parts.some(part => part > 255)) {
        return { valid: false, reason: '无效的IPv4地址' };
      }
      
      // 0.0.0.0
      if (parts.every(part => part === 0)) {
        return { valid: false, reason: '不允许访问 0.0.0.0' };
      }
      
      // 广播地址 255.255.255.255
      if (parts.every(part => part === 255)) {
        return { valid: false, reason: '不允许访问广播地址' };
      }
    }
    
    // 先检查被阻止的主机（优先级高）
    if (this.BLOCKED_HOSTS.includes(hostname)) {
      return { valid: false, reason: '不允许访问该主机' };
    }
    
    // 再检查内网地址模式
    if (this.PRIVATE_IP_PATTERNS.some(pattern => pattern.test(hostname))) {
      return { valid: false, reason: '不允许访问内网地址' };
    }
    
    // 检查URL欺骗（user@host格式）
    if (parsedUrl.username || parsedUrl.password) {
      return { valid: false, reason: '不允许在URL中包含认证信息' };
    }
    
    // 检查端口
    if (parsedUrl.port) {
      const port = parseInt(parsedUrl.port);
      // 阻止常见的内部服务端口
      const blockedPorts = [22, 23, 25, 110, 143, 3306, 5432, 6379, 27017, 9200];
      if (blockedPorts.includes(port)) {
        return { valid: false, reason: `不允许访问端口 ${port}` };
      }
    }
    
    // DNS Rebinding 防护提示
    if (hostname !== parsedUrl.hostname) {
      return { valid: false, reason: 'URL主机名不一致' };
    }
    
    return { valid: true };
  }
  
  /**
   * 验证API Token格式
   */
  static validateApiToken(token: string): ValidationResult {
    if (!token) {
      return { valid: false, reason: 'Token不能为空' };
    }
    
    if (token.length < this.API_TOKEN_MIN_LENGTH) {
      return { valid: false, reason: `Token长度至少为${this.API_TOKEN_MIN_LENGTH}字符` };
    }
    
    // 检查字符集（字母数字、连字符、下划线）
    if (!/^[A-Za-z0-9\-_]+$/.test(token)) {
      return { valid: false, reason: 'Token包含非法字符' };
    }
    
    // 检查是否为常见的测试/示例token（只比较前缀部分）
    const testTokenPrefixes = [
      'test-token',
      'demo-token',
      'example-token'
    ];
    
    const exactTestTokens = [
      '12345678901234567890123456789012',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '00000000000000000000000000000000'
    ];
    
    // 检查前缀
    if (testTokenPrefixes.some(prefix => token.toLowerCase().startsWith(prefix))) {
      return { valid: false, reason: '不允许使用测试Token' };
    }
    
    // 检查完全匹配
    if (exactTestTokens.includes(token)) {
      return { valid: false, reason: '不允许使用测试Token' };
    }
    
    return { valid: true };
  }
  
  /**
   * 验证请求头中的Authorization
   */
  static validateAuthorizationHeader(authHeader: string | undefined): {
    valid: boolean;
    token?: string;
    reason?: string;
  } {
    // 处理 undefined 和空字符串
    if (!authHeader || authHeader === '') {
      return { valid: false, reason: '缺少Authorization头' };
    }
    
    // 处理只有 "Bearer" 或 "Bearer " 的情况
    const bearerPrefix = 'Bearer ';
    if (!authHeader.startsWith(bearerPrefix) || authHeader.trim() === 'Bearer') {
      return { valid: false, reason: 'Authorization格式错误，应为 Bearer <token>' };
    }
    
    const token = authHeader.substring(7).trim();
    const tokenValidation = this.validateApiToken(token);
    
    if (!tokenValidation.valid) {
      return { valid: false, reason: tokenValidation.reason };
    }
    
    return { valid: true, token };
  }
  
  /**
   * 验证style参数
   */
  static validateStyle(style: string | undefined): ValidationResult {
    if (!style) {
      return { valid: true }; // style是可选的
    }
    
    // 首先检查XSS攻击（优先级高）
    if (/<[^>]*>/g.test(style) || /[<>&"']/.test(style)) {
      return { valid: false, reason: 'style参数包含非法字符' };
    }
    
    // 然后检查有效值
    const validStyles = ['default', 'humorous', 'professional'];
    if (!validStyles.includes(style)) {
      return { valid: false, reason: `无效的style参数，必须是: ${validStyles.join(', ')}` };
    }
    
    return { valid: true };
  }
  
  /**
   * 验证language参数
   */
  static validateLanguage(language: string | undefined): ValidationResult {
    if (!language) {
      return { valid: true }; // language是可选的
    }
    
    // 简单的语言代码验证（ISO 639-1）
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
      return { valid: false, reason: '无效的语言代码格式' };
    }
    
    return { valid: true };
  }
  
  /**
   * 清理和转义用户输入（用于日志记录）
   */
  static sanitizeForLogging(input: string): string {
    return input
      .replace(/\r?\n/g, ' ')               // 先替换换行
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 再移除控制字符
      .substring(0, 200);                   // 限制长度
  }
}