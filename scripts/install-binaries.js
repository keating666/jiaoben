const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('📦 开始安装二进制依赖...');

// 确保 bin 目录存在
const binDir = path.join(__dirname, '..', 'bin');
if (!fs.existsSync(binDir)) {
  console.log('📁 创建 bin 目录...');
  fs.mkdirSync(binDir, { recursive: true });
}

// 检查运行环境
const isVercel = process.env.VERCEL === '1';
const platform = process.platform;

console.log(`🌍 检测到环境: ${isVercel ? 'Vercel' : 'Local'}, 平台: ${platform}`);

// 下载文件的通用函数
function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 处理重定向
        file.close();
        fs.unlinkSync(outputPath);
        return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outputPath);
        return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(outputPath);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(err);
    });
  });
}

// 安装 yt-dlp
async function installYtDlp() {
  const ytDlpPath = path.join(binDir, 'yt-dlp');
  
  if (fs.existsSync(ytDlpPath)) {
    // 检查是否能执行，如果不能则删除重新下载
    try {
      execSync(`"${ytDlpPath}" --version`, { encoding: 'utf8' });
      console.log('✅ yt-dlp 已存在且可执行，跳过下载');
      return;
    } catch (e) {
      console.log('⚠️  yt-dlp 存在但无法执行，删除并重新下载');
      fs.unlinkSync(ytDlpPath);
    }
  }
  
  console.log('⬇️  下载 yt-dlp...');
  
  try {
    let ytDlpUrl;
    
    if (platform === 'linux' || isVercel) {
      // Vercel 使用 Linux 环境 - 需要使用 Linux 版本
      ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
    } else if (platform === 'darwin') {
      // macOS
      ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
    } else if (platform === 'win32') {
      // Windows
      ytDlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    } else {
      throw new Error(`不支持的平台: ${platform}`);
    }
    
    await downloadFile(ytDlpUrl, ytDlpPath);
    
    // 添加执行权限 (Unix 系统)
    if (platform !== 'win32') {
      fs.chmodSync(ytDlpPath, '755');
    }
    
    console.log('✅ yt-dlp 安装成功');
    
  } catch (error) {
    console.error('❌ yt-dlp 安装失败:', error.message);
    
    // 备用方案：使用 curl 下载
    try {
      console.log('🔄 尝试备用方案...');
      const curlCommand = platform === 'win32' 
        ? `curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -o "${ytDlpPath}"`
        : platform === 'linux' || isVercel
        ? `curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" -o "${ytDlpPath}"`
        : `curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos" -o "${ytDlpPath}"`;
      
      execSync(curlCommand);
      
      if (platform !== 'win32') {
        execSync(`chmod +x "${ytDlpPath}"`);
      }
      
      console.log('✅ yt-dlp 备用方案安装成功');
    } catch (backupError) {
      console.error('❌ yt-dlp 备用方案也失败:', backupError.message);
      throw error;
    }
  }
}

// 安装 ffmpeg
async function installFfmpeg() {
  console.log('⬇️  安装 @ffmpeg-installer/ffmpeg...');
  
  try {
    // 使用 npm 安装 ffmpeg
    const npmCommand = isVercel ? 'npm install --production' : 'npm install';
    execSync(`${npmCommand} @ffmpeg-installer/ffmpeg@^1.1.0`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    console.log('✅ @ffmpeg-installer/ffmpeg 安装成功');
    
    // 验证 ffmpeg 可用性
    try {
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
      console.log(`📍 ffmpeg 路径: ${ffmpegPath}`);
      
      // 测试 ffmpeg 是否可执行
      execSync(`"${ffmpegPath}" -version`, { stdio: 'pipe' });
      console.log('✅ ffmpeg 验证成功');
      
    } catch (verifyError) {
      console.warn('⚠️  ffmpeg 验证失败，但包已安装');
    }
    
  } catch (error) {
    console.error('❌ @ffmpeg-installer/ffmpeg 安装失败:', error.message);
    throw error;
  }
}

// 创建依赖检查函数
function createDependencyChecker() {
  const checkerPath = path.join(__dirname, '..', 'tech-validation', 'utils', 'binary-checker.ts');
  
  // 确保目录存在
  const utilsDir = path.join(__dirname, '..', 'tech-validation', 'utils');
  if (!fs.existsSync(utilsDir)) {
    fs.mkdirSync(utilsDir, { recursive: true });
  }
  
  console.log('📝 创建依赖检查模块...');
  
  const checkerContent = `import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export interface BinaryStatus {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
}

export class BinaryChecker {
  private static binDir = join(__dirname, '..', '..', 'bin');

  static async checkYtDlp(): Promise<BinaryStatus> {
    const ytDlpPath = join(this.binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    
    if (!existsSync(ytDlpPath)) {
      return {
        available: false,
        error: 'yt-dlp 二进制文件不存在'
      };
    }

    try {
      const versionOutput = execSync(\`"\${ytDlpPath}" --version\`, { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      return {
        available: true,
        path: ytDlpPath,
        version: versionOutput.trim()
      };
    } catch (error) {
      return {
        available: false,
        path: ytDlpPath,
        error: \`yt-dlp 执行失败: \${error instanceof Error ? error.message : String(error)}\`
      };
    }
  }

  static async checkFfmpeg(): Promise<BinaryStatus> {
    try {
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
      
      if (!existsSync(ffmpegPath)) {
        return {
          available: false,
          error: 'ffmpeg 二进制文件不存在'
        };
      }

      const versionOutput = execSync(\`"\${ffmpegPath}" -version\`, { 
        encoding: 'utf8',
        timeout: 5000 
      });
      
      const versionMatch = versionOutput.match(/ffmpeg version ([^\\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      
      return {
        available: true,
        path: ffmpegPath,
        version
      };
    } catch (error) {
      return {
        available: false,
        error: \`ffmpeg 检查失败: \${error instanceof Error ? error.message : String(error)}\`
      };
    }
  }

  static async checkAll(): Promise<{ ytDlp: BinaryStatus; ffmpeg: BinaryStatus }> {
    const [ytDlp, ffmpeg] = await Promise.all([
      this.checkYtDlp(),
      this.checkFfmpeg()
    ]);

    return { ytDlp, ffmpeg };
  }

  static async ensureAvailable(): Promise<void> {
    const status = await this.checkAll();
    
    if (!status.ytDlp.available) {
      throw new Error(\`yt-dlp 不可用: \${status.ytDlp.error}\`);
    }
    
    if (!status.ffmpeg.available) {
      throw new Error(\`ffmpeg 不可用: \${status.ffmpeg.error}\`);
    }
    
    console.log('✅ 所有二进制依赖都可用');
    console.log(\`  yt-dlp: \${status.ytDlp.version} (\${status.ytDlp.path})\`);
    console.log(\`  ffmpeg: \${status.ffmpeg.version} (\${status.ffmpeg.path})\`);
  }
}`;

  fs.writeFileSync(checkerPath, checkerContent);
  console.log('✅ 依赖检查模块创建成功');
}

// 主执行流程
async function main() {
  try {
    await installYtDlp();
    await installFfmpeg();
    // 不需要创建 binary-checker.ts，文件已存在
    
    console.log('🎉 所有二进制依赖安装完成！');
    
  } catch (error) {
    console.error('💥 安装过程中出现错误:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { installYtDlp, installFfmpeg, createDependencyChecker };