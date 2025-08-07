# CLAUDE.md - 项目经验总结

## 项目背景
这是一个 AI API 技术验证项目，用于测试 MiniMax、Tongyi 等 AI 服务的集成。

## 重要经验教训 (2025-01-23)

### 🚨 CI/CD 部署错误分析

#### 问题描述
在 CI/CD 部署过程中出现了严重的基础错误，代码审查形同虚设，根本原因是：

1. **虚假的构建脚本**
   ```json
   // 错误的做法
   "build": "echo 'Build completed successfully'"
   ```
   这个脚本只是输出成功消息，实际上没有执行任何构建操作。

2. **表面成功的陷阱**
   - CI 显示绿灯 ✅
   - 构建日志显示"成功"
   - 但实际上没有生成任何编译产物

#### 根本原因
- **过度信任表面信号**：看到 CI 绿灯就认为一切正常
- **缺乏实质性验证**：没有检查构建产物是否真正生成
- **代码审查流于形式**：审查者可能只看了代码变更，没有深入理解执行逻辑

### ✅ 已实施的修复措施

1. **修复构建脚本**
   ```json
   "build": "tsc && ls -la dist/"
   ```

2. **添加构建产物验证**
   ```yaml
   - name: Verify build artifacts
     run: |
       if [ ! -f "dist/index.js" ]; then
         echo "❌ Error: dist/index.js not found!"
         exit 1
       fi
   ```

3. **创建根目录 package.json**
   - 统一管理项目依赖
   - 定义清晰的构建流程

### 📋 代码审查清单

在审查 CI/CD 相关代码时，必须检查：

1. **构建脚本真实性**
   - [ ] 构建命令是否真正执行编译/打包？
   - [ ] 是否只是 echo 或其他占位符？

2. **构建产物验证**
   - [ ] CI 是否验证了输出文件的存在？
   - [ ] 是否有 `ls` 或类似命令展示构建结果？

3. **测试覆盖**
   - [ ] 是否有测试验证构建产物的功能？
   - [ ] 集成测试是否真正运行？

4. **部署一致性**
   - [ ] CI 构建的内容是否与部署配置匹配？
   - [ ] 不同环境的配置是否同步？

### 🛡️ 预防措施

1. **强制验证步骤**
   - 所有构建脚本必须包含产物验证
   - CI 必须显式列出生成的文件

2. **真实性原则**
   - 禁止使用 echo 作为构建命令
   - 所有脚本必须有实际执行效果

3. **深度审查**
   - 不只看代码差异，要理解执行逻辑
   - 运行关键命令，验证实际效果

## 项目特定配置

### 目录结构
```
jiaoben/
├── api/              # Vercel Serverless Functions
├── tech-validation/  # TypeScript 技术验证代码
├── package.json      # 根目录配置（工作区管理）
└── vercel.json      # Vercel 部署配置
```

### 关键命令
- 构建检查：`npm run verify-build`
- 完整构建：`npm run build`
- 类型检查：`npm run typecheck`
- 代码检查：`npm run lint`

## 持续改进

这次事件提醒我们：
1. **永远不要相信表面的成功信号**
2. **实质性验证比形式化流程更重要**
3. **简单的错误往往最容易被忽视**

记住：一个 `echo` 语句就能骗过整个团队，这是对我们流程的警醒。

## 当前技术栈说明 (2025-08-07 更新)

### 🎯 生产环境技术栈
**部署在 Cloudflare Worker**
1. **TikHub** - 获取视频真实链接
2. **腾讯云 ASR** - 音频转文字（`/src/cloudflare-worker-tencent-asr.js`）
3. **通义千问** - 生成分镜头脚本

### 🔧 开发/测试环境
**部署在 Vercel**
1. **MiniMax** - 音频转文字（备用方案）
2. **通义千问** - 生成分镜头脚本

### ⚠️ 已废弃的服务
- **YunmaoClient** - 云猫转码（已废弃，测试还存在但不再使用）
- **IflyTek** - 科大讯飞（已实现但未使用）

## 项目状态记录 (2025-01-23)

### ✅ 已完成的基础设施
1. **CI/CD 完全配置**
   - GitHub Actions: ci.yml, deploy-vercel.yml, pr-check.yml
   - Vercel 自动部署已配置并运行正常
   - 测试覆盖率集成完成

2. **已实现的功能**
   - Story 0.1: Jest 测试框架（100% 完成）
   - Story 0.2: 视频转文字编排服务（95.25% DOD 合规）
     - 视频下载和音频提取
     - **生产环境**：Cloudflare Worker 使用腾讯云 ASR
     - **开发环境**：Vercel 部署使用 MiniMax（备用）
     - Tongyi 脚本生成集成
     - 完整的错误处理

3. **安全措施**
   - SSRF 防护实现
   - API Token 验证
   - 输入参数清理
   - 并发控制器（未完全集成）

### ✅ 最新完成的安全改进 (2025-01-23)
1. **安全验证器集成**
   - 在 `/api/video/transcribe.ts` 中集成了 SecurityValidator
   - 验证所有输入参数（URL、API Token、style、language）
   - 日志脱敏处理，防止敏感信息泄露

2. **并发控制实施**
   - API 端点限制 3 个并发请求
   - TongyiClient 限制 5 个并发请求
   - 防止资源耗尽攻击

3. **EnhancedApiClient 升级**
   - TongyiClient 升级使用带断路器的 EnhancedApiClient
   - MiniMaxClientV2 已使用 EnhancedApiClient

4. **资源清理机制**
   - 所有客户端添加了 dispose() 方法
   - 确保资源正确释放，防止内存泄漏

5. **测试修复**
   - 修复了所有 security-validator.test.ts 测试（36/36 通过）
   - 所有并发控制器测试通过（12/12）

### ✅ 最新完成的功能 (2025-01-24)

#### 抖音链接提取功能
1. **创建了 DouyinLinkExtractor 类**
   - 专门处理抖音链接的提取和规范化
   - 支持多种抖音链接格式（短链接、完整链接、带参数链接）
   - 提供批量提取功能
   - 自动清理 URL 中的追踪参数和特殊字符

2. **创建了 DouyinDownloader 类**
   - 基于 youtube-dl-exec 实现视频信息获取
   - 支持视频下载和音频提取
   - 包含批量下载功能
   - 提供资源清理机制

3. **完整的测试覆盖**
   - 19 个单元测试全部通过
   - 包含链接提取、URL规范化、视频ID提取等测试
   - 创建了集成测试脚本

4. **集成到主工作流程**
   - API 端点优先使用 DouyinLinkExtractor
   - 保持向后兼容，支持其他平台链接
   - 三层提取策略：抖音专用 → 通用正则 → AI提取

### ⚠️ 待处理事项
- 手工测试待执行
- youtube-dl 对抖音的支持有限，可能需要其他解决方案

### 🔧 环境变量配置说明 (2025-01-24)

#### 本地环境变量
- **配置文件位置**: `/tech-validation/.env`
- **状态**: ✅ 已完整配置所有必需的 API 密钥
- **验证方法**: 
  ```bash
  cd tech-validation
  node -r dotenv/config scripts/validate-env.js
  ```

#### Vercel 部署环境变量
- **状态**: ✅ 已在 Vercel Dashboard 中完成配置 (2025-01-24)
- **已配置的环境变量**:
  - MINIMAX_API_BASE_URL
  - MINIMAX_GROUP_ID
  - TONGYI_API_KEY
  - TONGYI_API_BASE_URL
  - TONGYI_MODEL
  - IFLYTEK_APP_ID
  - IFLYTEK_API_SECRET
  - 其他必需的 API 密钥和配置
- **配置时间**: 4 小时前（根据截图显示）

### 📝 重要提醒
**不需要重新配置的内容**：
- CI/CD 流程（已完全配置）
- Vercel 部署（已自动化）
- 测试框架（Jest 已配置）
- GitHub Actions（所有工作流已就绪）

## Vercel 部署经验总结 (2025-01-23)

### 🎯 Vercel 项目结构理解

#### 关键认知
1. **Vercel 不是传统的 Node.js 应用托管**
   - 它是 Serverless Functions 平台
   - 每个 API 文件是独立的函数
   - 没有持续运行的服务器进程

2. **目录结构约定**
   ```
   /api/          # Serverless Functions（自动识别）
   /public/       # 静态文件（需要配置路由）
   /              # 根目录文件默认不公开
   ```

3. **路由配置很重要**
   - API 路由自动工作：`/api/*` → API Functions
   - 静态文件需要显式配置路由规则
   - 没有配置路由的文件会返回 404

#### 常见错误
1. **试图运行 `npm run dev` 启动服务器**
   - 错误：期望像传统 Express 应用一样运行
   - 正确：使用 `vercel dev` 本地模拟 Serverless 环境

2. **静态文件 404**
   - 错误：假设 `/public/` 目录自动可访问
   - 正确：需要在 `vercel.json` 配置路由规则

3. **CORS 问题**
   - 本地 HTML 文件无法调用部署的 API（浏览器安全策略）
   - 解决方案：将测试页面也部署到 Vercel

#### 正确的测试方法
1. **API 测试**
   - 使用 Postman（推荐，无 CORS 限制）
   - 使用 curl（终端测试）
   - 部署测试页面到同域

2. **本地开发**
   ```bash
   vercel dev    # 模拟 Serverless 环境
   ```

3. **部署流程**
   ```bash
   git push      # 自动触发部署
   vercel logs   # 查看运行日志
   ```

#### vercel.json 配置要点
```json
{
  "version": 2,
  "functions": {
    "api/video/transcribe.ts": {
      "maxDuration": 60  // 长时间处理任务
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"  // API 路由
    },
    {
      "src": "/(.*)",
      "dest": "/public/$1"  // 静态文件路由
    }
  ]
}
```

### 📝 经验教训
1. **充分理解平台特性**
   - Vercel 是 Serverless，不是传统服务器
   - 了解目录约定和路由规则
   - 理解函数超时限制（默认 10 秒，最大 60 秒）

2. **测试策略**
   - 部署测试工具到同一环境
   - 使用专业 API 测试工具（Postman）
   - 理解并处理 CORS 限制

3. **调试技巧**
   - 使用 `vercel logs` 查看实时日志
   - 检查函数配置和超时设置
   - 验证环境变量是否正确配置