# AI脚本平台 全栈架构文档 V1.0 (最终批准版)

### **1. 引言与开发策略**

本文档为“AI驱动的短视频脚本SaaS平台”项目定义了完整的、统一的全栈技术架构。它旨在作为所有后续开发工作的核心技术蓝图，确保系统设计的稳健性、可扩展性和安全性。

#### **开发起点策略**
* **策略**: 采用**“需求驱动的模板选型 (Requirement-Led Template Selection)”**。
* **描述**: 我们首先在本文件中明确定义项目的核心架构、技术栈和数据模型。然后，以此为标准，去寻找与我们设计最接近的、高质量的开源SaaS模板作为开发基础，以兼顾开发速度与架构的长期健康。

#### **变更日志 (Change Log)**
| 日期 | 版本 | 描述 | 作者 |
| :--- | :--- | :--- | :--- |
| 2025-07-22 | 1.0 | 初始架构设计、多轮专家评审与最终修订 | Winston (Architect) & BMad-Team |

---
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

---
### **3. 技术栈 (Tech Stack)**

| 分类 | 技术选型 | 主要用途 |
| :--- | :--- | :--- |
| **云平台** | Vercel, Supabase | 应用托管, 后端服务 |
| **前端框架** | Next.js | Web应用框架 |
| **编程语言** | TypeScript | 全栈开发语言 |
| **UI库 (B端)**| Ant Design (AntD) | 管理后台界面构建 |
| **UI库 (C端)**| Tailwind CSS | 用户界面构建 |
| **数据库ORM**| Prisma | 数据访问与操作 |
| **缓存服务**| Vercel KV | 看板等功能的数据缓存 |
| **监控服务**| Vercel Analytics, Sentry | 性能监控, 错误追踪 |
| **CI/CD**| GitHub Actions + Vercel | 自动化构建与部署 |

---
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
````

-----

### **5. 外部API集成**

#### **语音转文字 (Speech-to-Text) 服务:**

  * **主服务商 (Primary):** MiniMax
  * **备用服务商 (Backup):** 讯飞星火 (iFlytek Spark)

#### **文本再创作 (LLM) 服务:**

  * **主服务商 (Primary):** 通义千问 (Alibaba Qwen)
  * **备用服务商 (Backup):** MiniMax

**架构要求**: 系统需设计一个“AI服务抽象层”，并具备熔断、降级和自动切换主备服务商的机制，以确保服务的稳定性。

-----

### **6. API规格 (API Spec)**

  * **策略**: 在MVP阶段，采用\*\*共享TypeScript类型作为“数据契约”\*\*的轻量级API规格定义方式。所有相关的类型定义都存放在`/packages/api-contract`包中。

-----

### **7. 数据库模式 (Database Schema)**

数据库结构将使用Prisma Schema语法定义，以下为MVP阶段所需的完整核心模型：

```prisma
// --- Enums ---
enum Role { CUSTOMER, SALES, ADMIN, SUPER_ADMIN }
enum UserStatus { UNREGISTERED_LEAD, PENDING_ACTIVATION, IN_TRIAL, ACTIVATED, EXPIRED }

// --- Core Models ---
model User {
  id           String      @id @default(uuid())
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  deletedAt    DateTime?
  phoneNumber  String      @unique
  passwordHash String
  role         Role        @default(CUSTOMER)
  status       UserStatus  @default(PENDING_ACTIVATION) @index
  profile      UserProfile?
  salesOwnerId String?     @index
  salesOwner   User?       @relation("SalesToCustomers", fields: [salesOwnerId], references: [id])
  customers    User[]      @relation("SalesToCustomers")
  scripts      Script[]
  ipReports    IP_Report[]
  assignedCodes RedemptionCode[] @relation("SalesRedemptionCodes")
  usedCodes    RedemptionCode[] @relation("UserRedemptionCodes")
  events       UserEvent[]
}

model UserProfile {
  id        String    @id @default(uuid())
  userId    String    @unique
  user      User      @relation(fields: [userId], references: [id])
  name      String
  industry  String?
}

model Script {
  id        String    @id @default(uuid())
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  title     String
  content   Json
  ownerId   String
  owner     User      @relation(fields: [ownerId], references: [id])
}

model IP_Report {
  id        String    @id @default(uuid())
  createdAt DateTime  @default(now())
  deletedAt DateTime?
  reportData Json
  ownerId   String
  owner     User      @relation(fields: [ownerId], references: [id])
}

model RedemptionCode {
  id           String    @id @default(uuid())
  createdAt    DateTime  @default(now())
  code         String    @unique
  type         String    // "TRIAL" 或 "OFFICIAL"
  expiresAt    DateTime?
  isUsed       Boolean   @default(false)
  usedById     String?
  usedBy       User?     @relation("UserRedemptionCodes", fields: [usedById], references: [id])
  assignedToId String?
  assignedTo   User?     @relation("SalesRedemptionCodes", fields: [assignedToId], references: [id])
  assignedAt   DateTime?
}

model UserEvent {
  id        String    @id @default(uuid())
  timestamp DateTime  @default(now())
  type      String
  payload   Json?
  actorId   String
  actor     User      @relation(fields: [actorId], references: [id])
}

model SystemConfig {
  id        String   @id @default(uuid())
  key       String   @unique
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?
}

model LeadImportRecord {
  id           String   @id @default(uuid())
  createdAt    DateTime @default(now())
  fileName     String
  totalCount   Int
  successCount Int
  failedCount  Int
  importedBy   String
  details      Json?
}
```

-----

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

-----

### **9. 关键技术细节**

  * **安全性**: 用户手机号等敏感数据将采用 **Supabase列级加密(CLE)** 策略进行保护。
  * **性能**: 管理后台的数据看板将采用 **Vercel KV** 进行数据缓存，避免对主数据库的实时复杂查询。
  * **存储**: 脚本、报告等长文本/Json内容，将优先考虑存储在 **Supabase Storage** 中，数据库只保留文件链接，以优化主数据库性能。
  * **产品需求**: 用于AI仿写的用户上传视频，时长**不得超过60秒**。
  * 诸如**错误处理策略、测试策略、安全规范**等更详细的实施规范，将在**史诗1**的开发过程中，结合具体的代码实践来进一步定义和完善，并遵循所选技术栈的行业最佳实践。

<!-- end list -->