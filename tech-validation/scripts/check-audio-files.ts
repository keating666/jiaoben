#!/usr/bin/env ts-node

import fs from 'fs';
import path from 'path';
import { Config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * 检查测试音频文件
 */
async function checkAudioFiles() {
  console.log('\\n=== 测试音频文件检查 ===\\n');
  
  const testConfig = Config.getTestConfig();
  const audioFiles = [
    { name: '30秒音频', path: testConfig.audio30sPath },
    { name: '45秒音频', path: testConfig.audio45sPath }, 
    { name: '60秒音频', path: testConfig.audio60sPath },
  ];

  let allFilesReady = true;

  for (const file of audioFiles) {
    const fullPath = path.resolve(file.path);
    
    try {
      const stats = fs.statSync(fullPath);
      const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`✅ ${file.name}: ${fullPath}`);
      console.log(`   文件大小: ${sizeInMB} MB`);
      console.log(`   最后修改: ${stats.mtime.toLocaleString()}`);
      
      logger.info('AudioFileCheck', 'check', `${file.name}文件检查通过`, {
        path: fullPath,
        size: stats.size,
        sizeInMB: parseFloat(sizeInMB),
      });
      
    } catch (error) {
      console.log(`❌ ${file.name}: ${fullPath}`);
      console.log(`   错误: 文件不存在或无法访问`);
      
      logger.error('AudioFileCheck', 'check', `${file.name}文件检查失败`, error as Error, {
        path: fullPath,
      });
      
      allFilesReady = false;
    }
    
    console.log('');
  }

  // 显示总结
  if (allFilesReady) {
    console.log('🎉 所有测试音频文件准备就绪！');
    console.log('\\n可以运行以下命令开始测试:');
    console.log('  npm run test:minimax');
  } else {
    console.log('⚠️  部分音频文件缺失，请参考 test-data/README.md 准备文件');
    
    console.log('\\n📋 需要准备的文件:');
    audioFiles.forEach(file => {
      console.log(`  - ${path.basename(file.path)} (${file.name})`);
    });
    
    console.log('\\n📖 详细说明请查看: test-data/README.md');
  }

  // 检查目录结构
  console.log('\\n=== 项目目录结构检查 ===');
  const projectRoot = path.resolve('.');
  const requiredDirs = [
    'scripts',
    'interfaces', 
    'utils',
    'test-data',
  ];

  requiredDirs.forEach(dir => {
    const dirPath = path.join(projectRoot, dir);
    const exists = fs.existsSync(dirPath);
    console.log(`${exists ? '✅' : '❌'} ${dir}/`);
  });

  // 输出日志摘要
  logger.printSummary();

  return allFilesReady;
}

// 如果直接运行此文件，执行检查
if (require.main === module) {
  checkAudioFiles().catch(console.error);
}

export { checkAudioFiles };