import { DouyinLinkExtractor } from '../utils/douyin-link-extractor';
import { DouyinDownloader } from '../utils/douyin-downloader';
import { config } from 'dotenv';

// 加载环境变量
config();

async function main() {
  console.log('🎯 测试抖音链接提取器\n');

  // 测试用例
  const testCases = [
    '看看这个视频 https://v.douyin.com/iRyLb8kf/ 很有趣',
    '【抖音】https://www.douyin.com/video/7123456789012345678',
    '分享链接：v.douyin.com/abcdefg 快来看',
    'https://v.douyin.com/iRyLb8kf/?utm_source=copy_link 这是带参数的',
    '这里有多个链接 https://v.douyin.com/link1/ 和 https://v.douyin.com/link2/',
    '没有任何链接的文本',
  ];

  console.log('=== 1. 链接提取测试 ===\n');
  
  for (const text of testCases) {
    console.log(`测试文本: "${text}"`);
    
    // 单个链接提取
    const result = DouyinLinkExtractor.extractDouyinLink(text);
    if (result) {
      console.log(`✅ 提取成功:`);
      console.log(`   URL: ${result.url}`);
      console.log(`   平台: ${result.platform}`);
      
      // 验证URL
      const isValid = DouyinLinkExtractor.isValidDouyinUrl(result.url);
      console.log(`   有效性: ${isValid ? '✅' : '❌'}`);
      
      // 提取视频ID
      const videoId = DouyinLinkExtractor.extractVideoId(result.url);
      console.log(`   视频ID: ${videoId || '未提取到'}`);
    } else {
      console.log(`❌ 未找到抖音链接`);
    }
    
    // 批量提取
    const allLinks = DouyinLinkExtractor.extractAllDouyinLinks(text);
    if (allLinks.length > 1) {
      console.log(`   批量提取: 找到 ${allLinks.length} 个链接`);
    }
    
    console.log('');
  }

  console.log('\n=== 2. URL 规范化测试 ===\n');
  
  const urlsToNormalize = [
    'v.douyin.com/iRyLb8kf',
    'https://v.douyin.com/iRyLb8kf/！',
    'https://v.douyin.com/iRyLb8kf/?utm_source=copy',
    'https://v.douyin.com/iRyLb8kf/  ',
  ];
  
  for (const url of urlsToNormalize) {
    const normalized = DouyinLinkExtractor.normalizeUrl(url);
    console.log(`原始: "${url}"`);
    console.log(`规范: "${normalized}"\n`);
  }

  console.log('\n=== 3. 视频信息获取测试 ===\n');
  
  // 测试真实的抖音链接（如果有的话）
  const realDouyinUrl = 'https://v.douyin.com/iRyLb8kf/'; // 这里需要替换为真实链接
  
  console.log(`测试链接: ${realDouyinUrl}`);
  console.log('⚠️  注意: 视频信息获取需要真实的抖音链接才能成功\n');
  
  const downloader = new DouyinDownloader({
    outputDir: './test-downloads',
    format: 'mp4',
    quality: 'best',
  });
  
  try {
    console.log('尝试获取视频信息...');
    const videoInfo = await downloader.getVideoInfo(realDouyinUrl);
    
    if (videoInfo) {
      console.log('✅ 视频信息获取成功:');
      console.log(`   视频ID: ${videoInfo.videoId}`);
      console.log(`   标题: ${videoInfo.title || '未获取'}`);
      console.log(`   作者: ${videoInfo.author || '未获取'}`);
      console.log(`   时长: ${videoInfo.duration ? `${videoInfo.duration}秒` : '未获取'}`);
    } else {
      console.log('❌ 无法获取视频信息');
    }
  } catch (error) {
    console.error('❌ 获取视频信息时出错:', error);
  }

  console.log('\n=== 4. 短链接解析测试 ===\n');
  
  try {
    const shortUrl = 'https://v.douyin.com/iRyLb8kf';
    console.log(`解析短链接: ${shortUrl}`);
    const resolvedUrl = await DouyinLinkExtractor.resolveShortLink(shortUrl);
    
    if (resolvedUrl) {
      console.log(`✅ 解析成功: ${resolvedUrl}`);
    } else {
      console.log('❌ 解析失败');
    }
  } catch (error) {
    console.error('❌ 解析短链接时出错:', error);
  }

  console.log('\n测试完成！');
}

// 运行测试
main().catch(console.error);