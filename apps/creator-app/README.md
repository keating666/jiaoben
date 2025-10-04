# Creator App - 脚本仿写助手 C端应用

这是脚本仿写助手的 C端用户应用，基于 Next.js 14 构建。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **部署**: Cloudflare Pages

## 开发

### 前置要求

- Node.js 18+
- npm 8+

### 安装依赖

在项目根目录运行：

```bash
npm install
```

### 启动开发服务器

```bash
# 从根目录运行
npm run dev --workspace=@jiaoben/creator-app

# 或者进入 apps/creator-app 目录
cd apps/creator-app
npm run dev
```

应用将在 http://localhost:3000 启动。

### 构建

```bash
# 从根目录运行
npm run build --workspace=@jiaoben/creator-app

# 或者
cd apps/creator-app
npm run build
```

构建产物将生成在 `out/` 目录。

### 代码检查

```bash
npm run lint --workspace=@jiaoben/creator-app
npm run type-check --workspace=@jiaoben/creator-app
```

## 项目结构

```
apps/creator-app/
├── app/                 # Next.js App Router 目录
│   ├── layout.tsx      # 根布局
│   ├── page.tsx        # 首页
│   └── globals.css     # 全局样式
├── public/             # 静态资源
├── next.config.js      # Next.js 配置
├── tailwind.config.ts  # Tailwind 配置
├── tsconfig.json       # TypeScript 配置
└── package.json        # 依赖配置
```

## 部署

应用配置为静态导出模式，适配 Cloudflare Pages 部署。

### 自动部署

推送到 `main` 分支会触发 GitHub Actions 自动部署到 Cloudflare Pages。

### 手动部署

```bash
npm run build
# 将 out/ 目录部署到 Cloudflare Pages
```

## 环境变量

暂无环境变量需求。

## 许可

Private
