#!/bin/bash

echo "测试腾讯云ASR调试端点..."
curl -X GET https://jiaoben-api.keating8500.workers.dev/api/debug-asr

echo -e "\n\n测试API健康状态..."
curl -X GET https://jiaoben-api.keating8500.workers.dev/api/test