#!/bin/bash

echo "🎬 启动原生 WebAV 播放器"
echo "=========================="

# 检查Python是否可用
if ! command -v python3 &> /dev/null; then
    echo "❌ 需要安装 Python 3"
    exit 1
fi

# 检查端口是否被占用
PORT=8080
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
    echo "⚠️  端口 $PORT 已被占用，尝试端口 $((PORT + 1))"
    PORT=$((PORT + 1))
done

echo "🚀 启动服务器在端口 $PORT..."
echo ""
echo "📱 访问地址:"
echo "   🎬 原生播放器: http://localhost:$PORT/native-player.html"
echo "   🔧 简单测试:   http://localhost:$PORT/simple.html"
echo "   📋 调试页面:   http://localhost:$PORT/debug.html"
echo ""
echo "💡 使用说明:"
echo "   1. 在浏览器中打开上面的链接"
echo "   2. 点击'选择视频文件'按钮"
echo "   3. 选择一个 MP4/WebM 视频文件"
echo "   4. 点击播放按钮开始播放"
echo ""
echo "🛑 按 Ctrl+C 停止服务器"
echo "=========================="

# 启动服务器（使用Python内置HTTP服务器）
echo "🌍 使用Python内置HTTP服务器..."
python3 -m http.server $PORT --bind 0.0.0.0