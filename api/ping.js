// 最简单的 API，不依赖任何模块
export default function handler(req, res) {
  res.status(200).send('pong');
}