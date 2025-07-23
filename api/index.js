// Vercel Serverless Function
module.exports = (req, res) => {
  res.status(200).json({
    message: '🎉 恭喜！您的 CI/CD 已经成功部署！',
    project: 'jiaoben - 技术验证项目',
    timestamp: new Date().toISOString(),
    description: '这是一个用于验证 AI API 集成的项目',
    features: [
      'MiniMax API 语音转文字',
      'Tongyi API 文本生成',
      'IP 诊断服务'
    ],
    status: 'deployed successfully'
  });
};