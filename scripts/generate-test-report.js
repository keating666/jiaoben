#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 测试数据（实际使用时从测试脚本输出读取）
const testResults = {
  timestamp: new Date().toISOString(),
  environment: process.argv[2] || 'local',
  apiUrl: process.argv[3] || 'http://localhost:3000',
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    passRate: 0
  },
  categories: {
    '基础功能': [],
    '安全测试': [],
    '错误处理': [],
    '性能测试': [],
    '资源管理': []
  }
};

// 从标准输入读取测试结果
function parseTestResults(input) {
  const lines = input.split('\n');
  let currentCategory = '';
  
  lines.forEach(line => {
    // 解析测试类别
    if (line.includes('一、基础功能测试')) currentCategory = '基础功能';
    else if (line.includes('二、安全测试')) currentCategory = '安全测试';
    else if (line.includes('三、错误处理测试')) currentCategory = '错误处理';
    else if (line.includes('四、性能测试')) currentCategory = '性能测试';
    else if (line.includes('五、资源清理验证')) currentCategory = '资源管理';
    
    // 解析测试结果
    const passMatch = line.match(/✓\s+(.+)/);
    const failMatch = line.match(/✗\s+(.+)/);
    
    if (passMatch && currentCategory) {
      testResults.categories[currentCategory].push({
        name: passMatch[1],
        status: 'passed',
        time: new Date().toISOString()
      });
      testResults.summary.passed++;
      testResults.summary.total++;
    } else if (failMatch && currentCategory) {
      testResults.categories[currentCategory].push({
        name: failMatch[1],
        status: 'failed',
        time: new Date().toISOString()
      });
      testResults.summary.failed++;
      testResults.summary.total++;
    }
  });
  
  testResults.summary.passRate = testResults.summary.total > 0 
    ? (testResults.summary.passed / testResults.summary.total * 100).toFixed(1)
    : 0;
}

// 生成 HTML 报告
function generateHTMLReport() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Story 0.2 测试报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .metric {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            transition: transform 0.2s;
        }
        .metric:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .metric h3 {
            margin: 0 0 10px 0;
            color: #666;
            font-size: 14px;
            text-transform: uppercase;
        }
        .metric .value {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric.passed .value { color: #4CAF50; }
        .metric.failed .value { color: #f44336; }
        .metric.total .value { color: #2196F3; }
        .metric.rate .value { color: #FF9800; }
        
        .category {
            margin: 30px 0;
        }
        .category h2 {
            color: #555;
            border-left: 4px solid #4CAF50;
            padding-left: 15px;
            margin-bottom: 20px;
        }
        .test-item {
            display: flex;
            align-items: center;
            padding: 12px;
            margin: 5px 0;
            background: #f8f9fa;
            border-radius: 5px;
            transition: all 0.2s;
        }
        .test-item:hover {
            background: #e8f5e9;
        }
        .test-item.failed:hover {
            background: #ffebee;
        }
        .status-icon {
            width: 24px;
            height: 24px;
            margin-right: 15px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
        }
        .status-icon.passed {
            background: #4CAF50;
        }
        .status-icon.failed {
            background: #f44336;
        }
        .test-name {
            flex: 1;
            color: #333;
        }
        .timestamp {
            color: #999;
            font-size: 12px;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            text-align: center;
            color: #666;
        }
        .deploy-recommendation {
            margin: 30px 0;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .deploy-recommendation.ready {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .deploy-recommendation.not-ready {
            background: #ffebee;
            color: #c62828;
        }
        @media (max-width: 768px) {
            .summary {
                grid-template-columns: 1fr 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Story 0.2 视频转文字编排服务 - 测试报告</h1>
        
        <div class="summary">
            <div class="metric total">
                <h3>总测试数</h3>
                <div class="value">${testResults.summary.total}</div>
            </div>
            <div class="metric passed">
                <h3>通过</h3>
                <div class="value">${testResults.summary.passed}</div>
            </div>
            <div class="metric failed">
                <h3>失败</h3>
                <div class="value">${testResults.summary.failed}</div>
            </div>
            <div class="metric rate">
                <h3>通过率</h3>
                <div class="value">${testResults.summary.passRate}%</div>
            </div>
        </div>
        
        <div class="deploy-recommendation ${testResults.summary.failed === 0 ? 'ready' : 'not-ready'}">
            ${testResults.summary.failed === 0 
              ? '✅ 所有测试通过！可以安全部署到生产环境。'
              : `⚠️ 有 ${testResults.summary.failed} 个测试失败，请修复后再部署。`}
        </div>
        
        ${Object.entries(testResults.categories).map(([category, tests]) => `
            <div class="category">
                <h2>${category} (${tests.filter(t => t.status === 'passed').length}/${tests.length})</h2>
                ${tests.map(test => `
                    <div class="test-item ${test.status}">
                        <div class="status-icon ${test.status}">
                            ${test.status === 'passed' ? '✓' : '✗'}
                        </div>
                        <div class="test-name">${test.name}</div>
                        <div class="timestamp">${new Date(test.time).toLocaleTimeString()}</div>
                    </div>
                `).join('')}
            </div>
        `).join('')}
        
        <div class="footer">
            <p>测试环境: ${testResults.environment} | API: ${testResults.apiUrl}</p>
            <p>生成时间: ${new Date(testResults.timestamp).toLocaleString('zh-CN')}</p>
        </div>
    </div>
</body>
</html>`;
  
  return html;
}

// 示例数据（实际使用时删除）
if (process.argv.length <= 2) {
  // 添加示例数据
  testResults.summary = { total: 15, passed: 13, failed: 2, passRate: 86.7 };
  testResults.categories = {
    '基础功能': [
      { name: 'API健康检查', status: 'passed', time: new Date().toISOString() },
      { name: '视频处理-默认风格', status: 'passed', time: new Date().toISOString() },
      { name: '视频处理-幽默风格', status: 'passed', time: new Date().toISOString() },
      { name: '视频处理-专业风格', status: 'passed', time: new Date().toISOString() }
    ],
    '安全测试': [
      { name: 'SSRF防护-localhost', status: 'passed', time: new Date().toISOString() },
      { name: 'SSRF防护-内网IP', status: 'passed', time: new Date().toISOString() },
      { name: 'XSS防护-style参数', status: 'passed', time: new Date().toISOString() },
      { name: '认证-缺少token', status: 'passed', time: new Date().toISOString() }
    ],
    '错误处理': [
      { name: '错误处理-无效URL', status: 'passed', time: new Date().toISOString() },
      { name: '错误处理-FTP协议', status: 'passed', time: new Date().toISOString() },
      { name: '错误处理-缺少参数', status: 'failed', time: new Date().toISOString() }
    ],
    '性能测试': [
      { name: '响应时间测试', status: 'passed', time: new Date().toISOString() },
      { name: '并发请求测试', status: 'failed', time: new Date().toISOString() }
    ],
    '资源管理': [
      { name: '临时文件清理', status: 'passed', time: new Date().toISOString() }
    ]
  };
}

// 生成报告
const reportDir = path.join(__dirname, '..', 'test-reports');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const reportPath = path.join(reportDir, `test-report-${Date.now()}.html`);
fs.writeFileSync(reportPath, generateHTMLReport());

console.log(`✅ 测试报告已生成: ${reportPath}`);
console.log(`📊 测试结果: ${testResults.summary.passed}/${testResults.summary.total} 通过 (${testResults.summary.passRate}%)`);

// 如果有失败的测试，返回非零退出码
process.exit(testResults.summary.failed > 0 ? 1 : 0);