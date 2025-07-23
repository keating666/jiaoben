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

***
