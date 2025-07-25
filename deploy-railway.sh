#!/bin/bash

echo "🚀 准备部署 Railway 视频处理服务..."

# 创建临时目录
TEMP_DIR="/tmp/railway-video-service-deploy"
rm -rf $TEMP_DIR
mkdir -p $TEMP_DIR

# 复制视频服务文件
cp -r railway-video-service/* $TEMP_DIR/
cd $TEMP_DIR

# 初始化 git 仓库
git init
git add .
git commit -m "Initial commit for Railway video service"

echo "
✅ 准备完成！

接下来请：
1. 在 GitHub 创建新仓库：railway-video-service
2. 运行以下命令推送代码：
   cd $TEMP_DIR
   git remote add origin https://github.com/keating666/railway-video-service.git
   git push -u origin main

3. 在 Railway 部署这个新仓库

临时文件位置：$TEMP_DIR
"