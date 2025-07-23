### **8. 源码树结构 (Source Tree)**

项目将采用以下经过开发者体验优化的Monorepo结构：

```
/your-project-name
|
|-- /apps
|   |-- /creator-app        # C端 (Next.js + Tailwind)
|   |-- /admin-app          # B端 (Next.js + AntD)
|
|-- /packages
|   |-- /api-contract       # 共享的API类型定义
|   |-- /ui                 # 共享的、无样式的UI基础组件
|   |-- /eslint-config      # 共享的ESLint配置
|   |-- /tsconfig           # 共享的TypeScript配置
|
|-- package.json
|-- turborepo.json          # Turborepo配置文件
|-- .gitignore
```

***
