#!/bin/bash
echo "================================"
echo "MCP 留言板服务器启动脚本"
echo "================================"
echo

cd "$(dirname "$0")/server"

if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "依赖安装失败！"
        exit 1
    fi
fi

if [ ! -d "dist" ]; then
    echo "正在编译 TypeScript..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "编译失败！"
        exit 1
    fi
fi

echo
echo "启动服务器 (SSE 模式)..."
echo "网页留言板: http://localhost:3000"
echo "SSE 端点: http://localhost:3000/sse"
echo
MCP_MODE=sse npm start
