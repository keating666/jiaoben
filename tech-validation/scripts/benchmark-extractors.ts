import { EnhancedDouyinExtractor } from '../utils/enhanced-douyin-extractor';
import { RobustDouyinExtractor } from '../utils/robust-douyin-extractor';
import { RegexSafety } from '../utils/regex-safety';

/**
 * 性能基准测试
 * 比较原版和健壮版的性能差异
 */
async function runBenchmark() {
  console.log('=== 抖音链接提取器性能基准测试 ===\n');
  
  // 测试数据集
  const testCases = [
    {
      name: '简单链接',
      text: 'https://v.douyin.com/iRyLb8kf/',
      iterations: 10000,
    },
    {
      name: '复杂文本',
      text: `看看这个视频 https://v.douyin.com/abc123/ 很有趣！
      还有这个 7.53 MQc:/ 复制打开抖音
      #美食探店# #周末去哪儿#
      关注@美食博主 的作品`,
      iterations: 5000,
    },
    {
      name: '长文本',
      text: `${'a'.repeat(1000)} https://v.douyin.com/test/ ${'b'.repeat(1000)}`,
      iterations: 1000,
    },
    {
      name: '多链接',
      text: Array(20).fill('https://v.douyin.com/test/').join(' '),
      iterations: 2000,
    },
    {
      name: '恶意输入',
      text: `${'#'.repeat(1000)}测试${'#'.repeat(1000)}`,
      iterations: 100,
    },
  ];
  
  // 对每个测试用例进行基准测试
  for (const testCase of testCases) {
    console.log(`\n测试: ${testCase.name}`);
    console.log(`文本长度: ${testCase.text.length} 字符`);
    console.log(`迭代次数: ${testCase.iterations}`);
    console.log('-'.repeat(50));
    
    // 测试增强版
    const enhancedStart = performance.now();

    for (let i = 0; i < testCase.iterations; i++) {
      await EnhancedDouyinExtractor.smartExtract(testCase.text);
    }
    const enhancedTime = performance.now() - enhancedStart;
    const enhancedAvg = enhancedTime / testCase.iterations;
    
    // 测试健壮版
    const robustStart = performance.now();

    for (let i = 0; i < testCase.iterations; i++) {
      await RobustDouyinExtractor.smartExtract(testCase.text);
    }
    const robustTime = performance.now() - robustStart;
    const robustAvg = robustTime / testCase.iterations;
    
    // 输出结果
    console.log(`增强版平均耗时: ${enhancedAvg.toFixed(3)}ms`);
    console.log(`健壮版平均耗时: ${robustAvg.toFixed(3)}ms`);
    console.log(`性能差异: ${((robustAvg / enhancedAvg - 1) * 100).toFixed(1)}%`);
    
    // 验证结果一致性
    const enhancedResult = await EnhancedDouyinExtractor.smartExtract(testCase.text);
    const robustResult = await RobustDouyinExtractor.smartExtract(testCase.text);
    
    console.log('\n结果一致性检查:');
    console.log(`- 链接数量: 增强版=${enhancedResult.links.length}, 健壮版=${robustResult.links.length}`);
    console.log(`- 口令数量: 增强版=${enhancedResult.commands.length}, 健壮版=${robustResult.commands.length}`);
  }
  
  // 正则安全性测试
  console.log('\n\n=== 正则表达式安全性测试 ===\n');
  
  const patterns = [
    { name: '安全模式', pattern: /https?:\/\/v\.douyin\.com\/[\w\d]{1,20}\/?/g },
    { name: '贪婪模式', pattern: /https?:\/\/v\.douyin\.com\/[\w\d]+\/?/g },
    { name: '危险模式', pattern: /https?:\/\/v\.douyin\.com\/.*\/?/g },
  ];
  
  const testTexts = [
    'https://v.douyin.com/abc123/',
    `https://v.douyin.com/${  'a'.repeat(100)  }/`,
    `https://v.douyin.com/${  'a'.repeat(1000)  }/`,
  ];
  
  for (const { name, pattern } of patterns) {
    console.log(`\n测试模式: ${name}`);
    console.log(`正则: ${pattern.source}`);
    
    // 验证安全性
    const validation = RegexSafety.validatePattern(pattern);

    console.log(`安全性: ${validation.safe ? '✅ 安全' : `❌ 不安全 - ${validation.reason}`}`);
    
    // 性能测试
    if (validation.safe) {
      const benchmark = RegexSafety.benchmarkPattern(pattern, testTexts);

      console.log(`平均耗时: ${benchmark.avgTime.toFixed(3)}ms`);
      console.log(`最大耗时: ${benchmark.maxTime.toFixed(3)}ms`);
      console.log(`性能评级: ${benchmark.safe ? '✅ 良好' : '⚠️ 需要优化'}`);
    }
  }
  
  // 内存使用测试
  console.log('\n\n=== 内存使用测试 ===\n');
  
  if (global.gc) {
    global.gc(); // 强制垃圾回收
    const memBefore = process.memoryUsage();
    
    // 执行大量提取
    const promises = [];

    for (let i = 0; i < 1000; i++) {
      promises.push(RobustDouyinExtractor.smartExtract('https://v.douyin.com/test/'));
    }
    await Promise.all(promises);
    
    const memAfter = process.memoryUsage();
    
    console.log(`堆内存增长: ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
    console.log(`外部内存增长: ${((memAfter.external - memBefore.external) / 1024 / 1024).toFixed(2)}MB`);
  } else {
    console.log('提示: 使用 --expose-gc 参数运行以启用内存测试');
  }
  
  console.log('\n=== 测试完成 ===');
}

// 运行基准测试
runBenchmark().catch(console.error);