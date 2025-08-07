#!/bin/bash

echo "🚀 WebAV 播放器 - Webpack 版本"
echo "================================"

# 检查Node.js和npm
if ! command -v node &> /dev/null; then
    echo "❌ 需要安装 Node.js (>= 16.0.0)"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ 需要安装 npm"
    exit 1
fi

echo "📦 Node.js: $(node --version)"
echo "📦 npm: $(npm --version)"

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo ""
    echo "🔧 安装依赖中..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

echo ""
echo "🌐 启动开发服务器..."
echo "📱 访问: http://localhost:9000"
echo "🛑 按 Ctrl+C 停止"
echo "================================"

npm run dev