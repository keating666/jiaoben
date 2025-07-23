### **2. 高层架构 (High Level Architecture)**

#### **技术平台与基础设施**

* **平台组合**: **Vercel + Supabase**
  * **Vercel**: 负责托管和部署我们的前端应用(Next.js)和无服务器API层(Serverless Functions)。
  * **Supabase**: 作为我们的“后端即服务(BaaS)”，提供PostgreSQL数据库、用户认证、文件存储等核心后端能力。

#### **代码仓库结构**

* **结构**: **单一仓库 (Monorepo)**
* **管理工具**: **Turborepo**

#### **架构与设计模式**

* **整体架构**: **Jamstack 架构**，实现内容静态化、功能动态化，以获得极致性能和安全性。
* **API通信**: **BFF (Backend-for-Frontend)** 模式，使用Vercel Serverless Functions作为BFF层。
* **数据访问**: **Repository Pattern (仓库模式)**，在BFF层中封装对Supabase的数据访问。
* **前端状态管理**: **Context API + Hooks** 的轻量级方案，按需引入更专业的库。

***
