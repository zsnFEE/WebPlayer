#!/bin/bash

echo "🚀 启动 WebAV 播放器 (Webpack 版本)"
echo "=================================="

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 需要安装 Node.js"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo "❌ 需要安装 npm"
    exit 1
fi

echo "📦 Node.js 版本: $(node --version)"
echo "📦 npm 版本: $(npm --version)"
echo ""

# 检查node_modules是否存在
if [ ! -d "node_modules" ]; then
    echo "🔧 首次运行，正在安装依赖..."
    echo "这可能需要几分钟时间，请耐心等待..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败，请检查网络连接"
        exit 1
    fi
    echo "✅ 依赖安装完成"
fi

echo ""
echo "🌐 启动开发服务器..."
echo "📱 访问地址: http://localhost:9000"
echo "🛑 按 Ctrl+C 停止服务器"
echo "=================================="

# 启动Webpack开发服务器
npm run dev