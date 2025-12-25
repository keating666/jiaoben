import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  
  res.status(200).json({
    success: true,
    message: '部署成功',
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      vercel: !!process.env.VERCEL,
      hasApiKeys: {
        minimax: !!process.env.MINIMAX_API_KEY,
        tongyi: !!process.env.TONGYI_API_KEY,
        replitUrl: !!process.env.REPLIT_VIDEO_SERVICE_URL
      }
    },
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime
  });
}