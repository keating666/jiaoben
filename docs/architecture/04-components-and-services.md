### **4. 组件与服务拆分**

系统核心服务组件将被划分为以下几个逻辑单元：

* **用户与认证服务 (User & Auth Service)**
* **脚本生成服务 (Script Generation Service)**
* **IP报告服务 (IP Report Service)**
* **管理后台服务 (Admin & Sales BFF Service)**
* **核心后端服务 (由Supabase提供)**

#### **组件交互图**

```mermaid
graph TD
    subgraph 用户端 (User's Browser)
        A[前端应用 (Creator/Admin UI)]
    end

    subgraph Vercel云平台
        B[Vercel Serverless Functions (BFF层)]
    end

    subgraph Supabase云平台
        C[用户认证 (Auth)]
        D[数据库 (PostgreSQL)]
        E[文件存储 (Storage)]
    end

    subgraph 第三方服务 (3rd Party)
        F[AI服务商 (MiniMax, 通义千问等)]
    end

    A -- HTTPS请求 --> B
    B -- 调用认证 --> C
    B -- 读写数据 --> D
    B -- 存取文件 --> E
    B -- 调用AI能力 --> F
```

***
