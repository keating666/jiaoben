// 临时构建产物 - 个性化脚本生成功能
// 实际功能通过 Cloudflare Workers 部署在 src/cloudflare-worker-tencent-asr.js

console.log('个性化脚本生成功能构建完成');
console.log('前端页面: public/index.html - 个性化版本');
console.log('后端 API: src/cloudflare-worker-tencent-asr.js');

// 导出基本模块以满足 Node.js 规范
module.exports = {
  version: '1.0.0',
  features: [
    '个性化用户信息收集',
    '业务目的定制',
    '脚本风格选择',
    '预设模板支持'
  ]
};