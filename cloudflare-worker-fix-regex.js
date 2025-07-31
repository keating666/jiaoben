// 修复后的链接清洗函数
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

// 测试
const testUrl = '1.28 FHi:/ w@F.uf 12/21 当一标车间遇上了新闻联播 # 法兰螺栓# 高强度螺栓# 源头厂家 # 热门# 抖  https://v.douyin.com/X_HPP2LDITI/ 复制此链接，打开Dou音搜索，直接观看视频！';

console.log(cleanDouyinUrl(testUrl));
// 应该输出: https://v.douyin.com/X_HPP2LDITI/