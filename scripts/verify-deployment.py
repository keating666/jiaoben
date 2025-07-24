#!/usr/bin/env python3

import requests
import json

BASE_URL = "https://jiaoben-7jx4.vercel.app"

print("🔍 验证 Vercel 部署...")
print("=" * 50)

# 测试 API
print("\n1. 测试 API 端点...")
try:
    response = requests.get(f"{BASE_URL}/api", timeout=10)
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        print(f"   响应: {response.json()}")
    else:
        print(f"   响应: {response.text}")
except Exception as e:
    print(f"   ❌ 错误: {e}")

# 测试静态页面
pages = ['/', '/index.html', '/vercel-test.html', '/test.html']
print("\n2. 测试静态页面...")
for page in pages:
    try:
        response = requests.get(f"{BASE_URL}{page}", timeout=10)
        print(f"   {page}: {response.status_code}")
    except Exception as e:
        print(f"   {page}: ❌ {e}")

print("\n" + "=" * 50)
print("如果 API 返回 200 但页面返回 404，说明静态文件路由有问题")