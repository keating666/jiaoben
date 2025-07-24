import { LinkExtractor } from '../utils/link-extractor';

// 测试您提供的抖音链接
const testText = `9.20 c@a.nd 01/22 ygo:/ 至于为什么周六不更，我的粉丝自会在评论区给出答案。 # 被盗视频 # 沙雕动画 # 二次元 # 原创动画 # 别划走  https://v.douyin.com/7Ygkcv5qidM/ 复制此链接，打开Dou音搜索，直接观看视频！`;

console.log('测试文本:', testText);
console.log('---');

const result = LinkExtractor.extractVideoLink(testText);

if (result) {
  console.log('✅ 成功提取链接!');
  console.log('URL:', result.url);
  console.log('平台:', result.platform);
  console.log('清理后的URL:', LinkExtractor.cleanUrl(result.url));
} else {
  console.log('❌ 提取失败!');
  
  // 尝试用简单的正则查看是否能找到链接
  const simpleMatch = testText.match(/https?:\/\/[^\s]+/);
  if (simpleMatch) {
    console.log('简单正则找到的链接:', simpleMatch[0]);
  }
}