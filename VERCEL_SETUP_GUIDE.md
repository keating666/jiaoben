# Vercel 项目配置详细指南

## 在 Vercel 项目配置页面，请按照以下设置：

### 1. Configure Project

**Project Name**: jiaoben-tech-validation（或保持默认）

**Framework Preset**: 选择 "Other"

### 2. Root Directory
保持默认 `./`

### 3. Build and Output Settings

点击 "Override" 开关，然后设置：

**Build Command**:
```
cd tech-validation && npm install && npm run build
```

**Output Directory**:
```
tech-validation/dist
```

**Install Command**:
```
cd tech-validation && npm install
```

### 4. Environment Variables

暂时不需要设置，点击 "Deploy"

### 5. 等待部署

- 第一次部署可能需要几分钟
- 部署成功后会显示您的网站地址
- 类似：https://jiaoben-xxx.vercel.app

## 部署后的操作

1. 记下您的项目 URL
2. 点击 "Go to Dashboard" 查看项目仪表板
3. 在 Settings 中可以找到需要的 ID 信息