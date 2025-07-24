import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // 检查环境变量是否正确加载
  const envCheck = {
    MINIMAX_API_KEY: !!process.env.MINIMAX_API_KEY,
    MINIMAX_GROUP_ID: !!process.env.MINIMAX_GROUP_ID,
    TONGYI_API_KEY: !!process.env.TONGYI_API_KEY,
    IFLYTEK_APP_ID: !!process.env.IFLYTEK_APP_ID,
    IFLYTEK_API_KEY: !!process.env.IFLYTEK_API_KEY,
    IFLYTEK_API_SECRET: !!process.env.IFLYTEK_API_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    // 检查部分值的长度（不暴露实际值）
    MINIMAX_KEY_LENGTH: process.env.MINIMAX_API_KEY?.length || 0,
    TONGYI_KEY_LENGTH: process.env.TONGYI_API_KEY?.length || 0,
  };

  res.status(200).json({
    success: true,
    message: '环境变量检查',
    envCheck,
    timestamp: new Date().toISOString(),
  });
}