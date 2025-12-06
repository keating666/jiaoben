import { EnhancedDouyinExtractor } from '../utils/enhanced-douyin-extractor';

/**
 * 测试增强版抖音链接提取器
 */
async function testEnhancedExtractor() {
  console.log('=== 增强版抖音链接提取器测试 ===\n');

  // 测试用例（包含真实案例）
  const testCases = [
    // ===== 标准链接格式 =====
    {
      name: '标准短链接',
      text: '看看这个视频 https://v.douyin.com/iRyLb8kf/ 很有趣',
    },
    {
      name: '链接紧跟中文',
      text: '刚看到https://v.douyin.com/abc123/笑死我了，你也看看',
    },
    {
      name: '多个链接',
      text: `推荐几个视频：
        1. https://v.douyin.com/video1/
        2. https://www.douyin.com/video/7123456789012345678
        3. 直播间：https://live.douyin.com/123456`,
    },
    
    // ===== 口令格式（基于真实案例） =====
    {
      name: '数字代码口令 - 复制此链接',
      text: '7.53 MQc:/ 复制此链接，打开抖音，直接观看视频！',
    },
    {
      name: '数字代码口令 - 复制打开抖音',
      text: '4.98 XhC:/ 复制打开抖音，看看【美食分享的作品】',
    },
    {
      name: '数字代码口令 - 打开Dou音',
      text: '9.27 pqZ:/ 06/26 打开Dou音，看看【健身教程】',
    },
    {
      name: 'dOU口令格式',
      text: 'dOU口令：aBc123XyZ 邀请你观看精彩内容',
    },
    
    // ===== 长按复制格式 =====
    {
      name: '长按复制此段话',
      text: '长按复制此段话$VGc7HhU8rQW$打开抖音，看看@小王的作品',
    },
    {
      name: '长按复制此条消息',
      text: '【抖音】长按复制此条消息，打开抖音搜索，查看TA的更多作品。',
    },
    
    // ===== 特殊编码格式 =====
    {
      name: '特殊编码 u0000ey',
      text: '复制 u0000eyWZ123 打开抖音查看精彩内容',
    },
    {
      name: '大写字母代码',
      text: 'WZ: abc123 CZ: def456 打开抖音APP',
    },
    
    // ===== 话题和标签 =====
    {
      name: '话题标签',
      text: '#在抖音，记录美好生活# #猫猫日常# 快来看看吧',
    },
    {
      name: '多个话题标签',
      text: '#美食探店# #周末去哪儿# #生活记录# 都在这里',
    },
    
    // ===== 淘口令格式 =====
    {
      name: '淘口令格式',
      text: '复制这段话￥dY4d2kPQFNe￥打开抖音，看看【张三的作品】',
    },
    {
      name: '复制整段话',
      text: '复制整段话$aBc123XyZ$打开抖音APP',
    },
    
    // ===== 分享码和邀请码 =====
    {
      name: '分享码',
      text: '分享码：XYZ789ABC 快来一起看直播',
    },
    {
      name: '邀请码',
      text: '邀请码: INVITE2024 加入抖音创作者计划',
    },
    
    // ===== 搜索指令 =====
    {
      name: '搜索指令',
      text: '抖音搜索：猫猫的日常生活 超级可爱',
    },
    {
      name: '@用户作品',
      text: '看看@美食博主小王的视频，真的很棒',
    },
    
    // ===== 真实复杂案例 =====
    {
      name: '真实分享文本1',
      text: `8.61 nqh:/ 06/26 复制打开抖音，看看【美食博主的作品】
      # 美食分享 # 家常菜教程 https://v.douyin.com/iRyLb8kf/`,
    },
    {
      name: '真实分享文本2',
      text: `【抖音】长按复制此条消息，打开抖音搜索，查看TA的更多作品。 https://v.douyin.com/ikRL6Sn/
      4.53 WQy:/ 复制打开抖音，看看【张三的日常vlog】# 生活记录 # 美食探店`,
    },
    {
      name: '抖音矩阵群邀请',
      text: '复制口令进抖音矩阵群 ￥Matrix2024Group￥ 一起创作优质内容',
    },
    
    // ===== 特殊场景 =====
    {
      name: '带追踪参数的链接',
      text: 'https://v.douyin.com/iRyLb8kf/?utm_source=copy&utm_campaign=client_share&share_app_id=1128&share_iid=123',
    },
    {
      name: '用户主页',
      text: '关注@小明的抖音主页 https://www.douyin.com/user/MS4wLjABAAAA1234567890',
    },
    {
      name: '抖音极速版链接',
      text: '抖音极速版专享 https://v.douyinvod.com/abc123/',
    },
    {
      name: 'TikTok国际版',
      text: '国际版看这里 https://vm.tiktok.com/ZMN123abc/',
    },
    
    // ===== 混合格式 =====
    {
      name: '多种格式混合',
      text: `看这个视频https://v.douyin.com/abc/，或者搜索#猫猫日常#
      也可以复制口令 7.53 MQc:/ 打开抖音APP查看
      分享码：SHARE2024`,
    },
    {
      name: '中英文混合',
      text: '看看这个Amazing视频 https://v.douyin.com/test/ 真的very good！',
    },
    
    // ===== 无效内容测试 =====
    {
      name: '无链接文本',
      text: '今天看了一个抖音视频，真的太搞笑了',
    },
    {
      name: '提到抖音但无链接',
      text: '抖音上那个猫猫视频你看了吗？超可爱的',
    },
  ];

  // 执行测试
  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.name}`);
    console.log(`输入: ${testCase.text.substring(0, 100)}${testCase.text.length > 100 ? '...' : ''}`);
    
    try {
      const result = await EnhancedDouyinExtractor.smartExtract(testCase.text);
      
      console.log('\n结果:');
      console.log(`- 提取方法: ${result.method}`);
      console.log(`- 置信度: ${(result.confidence * 100).toFixed(1)}%`);
      
      if (result.links.length > 0) {
        console.log(`- 链接 (${result.links.length}个):`);
        result.links.forEach((link, index) => {
          console.log(`  ${index + 1}. ${link.url} (类型: ${link.type})`);
        });
      }
      
      if (result.commands.length > 0) {
        console.log(`- 口令 (${result.commands.length}个):`);
        result.commands.forEach((cmd, index) => {
          console.log(`  ${index + 1}. ${cmd.content} (类型: ${cmd.type})`);
        });
      }
      
      if (result.suggestions && result.suggestions.length > 0) {
        console.log('- 建议:');
        result.suggestions.forEach((suggestion) => {
          console.log(`  * ${suggestion}`);
        });
      }
      
      console.log(`\n${  '='.repeat(50)}`);
    } catch (error) {
      console.error('错误:', error);
    }
  }
}

// 性能测试
async function performanceTest() {
  console.log('\n\n=== 性能测试 ===\n');
  
  const longText = `
    这里有很多抖音链接需要提取：
    ${Array.from({ length: 100 }, (_, i) => `
      视频${i + 1}: https://v.douyin.com/video${i}/
      口令${i + 1}: #视频标题${i}#
    `).join('\n')}
  `;
  
  console.log(`测试文本长度: ${longText.length} 字符`);
  
  const startTime = Date.now();
  const result = await EnhancedDouyinExtractor.smartExtract(longText);
  const endTime = Date.now();
  
  console.log(`提取耗时: ${endTime - startTime}ms`);
  console.log(`找到链接: ${result.links.length}个`);
  console.log(`找到口令: ${result.commands.length}个`);
}

// 执行测试
async function main() {
  await testEnhancedExtractor();
  await performanceTest();
}

main().catch(console.error);