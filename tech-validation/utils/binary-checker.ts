import { execSync } from 'child_process';
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
        error: 'yt-dlp 二进制文件不存在',
      };
    }

    try {
      const versionOutput = execSync(`"${ytDlpPath}" --version`, { 
        encoding: 'utf8',
        timeout: 5000, 
      });
      
      return {
        available: true,
        path: ytDlpPath,
        version: versionOutput.trim(),
      };
    } catch (error) {
      return {
        available: false,
        path: ytDlpPath,
        error: `yt-dlp 执行失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  static async checkFfmpeg(): Promise<BinaryStatus> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
      
      if (!existsSync(ffmpegPath)) {
        return {
          available: false,
          error: 'ffmpeg 二进制文件不存在',
        };
      }

      const versionOutput = execSync(`"${ffmpegPath}" -version`, { 
        encoding: 'utf8',
        timeout: 5000, 
      });
      
      const versionMatch = versionOutput.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';
      
      return {
        available: true,
        path: ffmpegPath,
        version,
      };
    } catch (error) {
      return {
        available: false,
        error: `ffmpeg 检查失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  static async checkAll(): Promise<{ ytDlp: BinaryStatus; ffmpeg: BinaryStatus }> {
    const [ytDlp, ffmpeg] = await Promise.all([
      this.checkYtDlp(),
      this.checkFfmpeg(),
    ]);

    return { ytDlp, ffmpeg };
  }

  static async ensureAvailable(): Promise<void> {
    const status = await this.checkAll();
    
    if (!status.ytDlp.available) {
      throw new Error(`yt-dlp 不可用: ${status.ytDlp.error}`);
    }
    
    if (!status.ffmpeg.available) {
      throw new Error(`ffmpeg 不可用: ${status.ffmpeg.error}`);
    }
    
    console.log('✅ 所有二进制依赖都可用');
    console.log(`  yt-dlp: ${status.ytDlp.version} (${status.ytDlp.path})`);
    console.log(`  ffmpeg: ${status.ffmpeg.version} (${status.ffmpeg.path})`);
  }
}