import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const envStatus = {
    MINIMAX_API_KEY: !!process.env.MINIMAX_API_KEY,
    MINIMAX_GROUP_ID: !!process.env.MINIMAX_GROUP_ID,
    TONGYI_API_KEY: !!process.env.TONGYI_API_KEY,
    REPLIT_VIDEO_SERVICE_URL: !!process.env.REPLIT_VIDEO_SERVICE_URL,
  };

  const allConfigured = Object.values(envStatus).every(v => v === true);

  res.status(200).json({
    configured: envStatus,
    ready: allConfigured,
    message: allConfigured ? '✅ 所有环境变量已配置' : '❌ 缺少必要的环境变量'
  });
}