#!/bin/bash

# Cloudflare Worker Secrets 设置脚本
# 用于配置 Tongyi API Worker 的环境变量

echo "🔐 Cloudflare Worker Secrets Setup"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI 未安装${NC}"
    echo "请先安装 Wrangler: npm install -g wrangler"
    exit 1
fi

echo -e "${GREEN}✅ Wrangler CLI 已安装${NC}"

# 选择要配置的 Worker
echo ""
echo "请选择要配置的 Worker:"
echo "1) 主 Worker (jiaoben-api) - 完整的视频处理流程"
echo "2) Tongyi API Worker (jiaoben-tongyi-api) - 独立的通义千问服务"
echo "3) 两个都配置"
read -p "请输入选择 (1/2/3): " WORKER_CHOICE

# 函数：设置主 Worker 的 secrets
setup_main_worker() {
    echo ""
    echo -e "${YELLOW}配置主 Worker (jiaoben-api)...${NC}"
    
    # TONGYI_API_KEY
    read -sp "请输入 TONGYI_API_KEY (通义千问 API 密钥): " TONGYI_KEY
    echo ""
    if [ ! -z "$TONGYI_KEY" ]; then
        echo "$TONGYI_KEY" | wrangler secret put TONGYI_API_KEY
        echo -e "${GREEN}✅ TONGYI_API_KEY 已设置${NC}"
    fi
    
    # TIKHUB_API_TOKEN
    read -sp "请输入 TIKHUB_API_TOKEN: " TIKHUB_TOKEN
    echo ""
    if [ ! -z "$TIKHUB_TOKEN" ]; then
        echo "$TIKHUB_TOKEN" | wrangler secret put TIKHUB_API_TOKEN
        echo -e "${GREEN}✅ TIKHUB_API_TOKEN 已设置${NC}"
    fi
    
    # TENCENT_SECRET_ID
    read -sp "请输入 TENCENT_SECRET_ID (腾讯云): " TENCENT_ID
    echo ""
    if [ ! -z "$TENCENT_ID" ]; then
        echo "$TENCENT_ID" | wrangler secret put TENCENT_SECRET_ID
        echo -e "${GREEN}✅ TENCENT_SECRET_ID 已设置${NC}"
    fi
    
    # TENCENT_SECRET_KEY
    read -sp "请输入 TENCENT_SECRET_KEY (腾讯云): " TENCENT_KEY
    echo ""
    if [ ! -z "$TENCENT_KEY" ]; then
        echo "$TENCENT_KEY" | wrangler secret put TENCENT_SECRET_KEY
        echo -e "${GREEN}✅ TENCENT_SECRET_KEY 已设置${NC}"
    fi
}

# 函数：设置 Tongyi API Worker 的 secrets
setup_tongyi_worker() {
    echo ""
    echo -e "${YELLOW}配置 Tongyi API Worker (jiaoben-tongyi-api)...${NC}"
    
    # TONGYI_API_KEY
    read -sp "请输入 TONGYI_API_KEY (通义千问 API 密钥): " TONGYI_KEY
    echo ""
    if [ ! -z "$TONGYI_KEY" ]; then
        echo "$TONGYI_KEY" | wrangler secret put TONGYI_API_KEY --config wrangler-tongyi.toml
        echo -e "${GREEN}✅ TONGYI_API_KEY 已设置${NC}"
    fi
    
    # API_AUTH_KEY
    read -sp "请输入 API_AUTH_KEY (API 认证密钥，留空使用默认值): " AUTH_KEY
    echo ""
    if [ ! -z "$AUTH_KEY" ]; then
        echo "$AUTH_KEY" | wrangler secret put API_AUTH_KEY --config wrangler-tongyi.toml
        echo -e "${GREEN}✅ API_AUTH_KEY 已设置${NC}"
    fi
}

# 根据选择执行配置
case $WORKER_CHOICE in
    1)
        setup_main_worker
        ;;
    2)
        setup_tongyi_worker
        ;;
    3)
        setup_main_worker
        setup_tongyi_worker
        ;;
    *)
        echo -e "${RED}无效的选择${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 配置完成！${NC}"
echo ""
echo "下一步操作:"
echo "1. 部署主 Worker: wrangler deploy"
echo "2. 部署 Tongyi API Worker: wrangler deploy --config wrangler-tongyi.toml"
echo ""
echo "查看已设置的 secrets:"
echo "- 主 Worker: wrangler secret list"
echo "- Tongyi API Worker: wrangler secret list --config wrangler-tongyi.toml"