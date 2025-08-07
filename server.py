#!/usr/bin/env python3
"""
简单的HTTP服务器 - 用于提供静态文件服务
不需要Node.js或任何构建工具
"""

import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加必要的CORS和安全头
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def guess_type(self, path):
        # 确保正确的MIME类型
        mimetype, encoding = super().guess_type(path)
        if path.endswith('.js'):
            return 'application/javascript', encoding
        elif path.endswith('.wasm'):
            return 'application/wasm', encoding
        return mimetype, encoding

def start_server(port=8000):
    """启动HTTP服务器"""
    handler = CustomHTTPRequestHandler
    
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"🚀 服务器启动成功!")
            print(f"📍 本地访问: http://localhost:{port}")
            print(f"🌐 网络访问: http://0.0.0.0:{port}")
            print(f"🎬 原生播放器: http://localhost:{port}/native-player.html")
            print(f"🔧 简单测试: http://localhost:{port}/simple.html")
            print("")
            print("按 Ctrl+C 停止服务器")
            print("=" * 50)
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n🛑 服务器已停止")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ 端口 {port} 已被占用，尝试使用端口 {port + 1}")
            start_server(port + 1)
        else:
            print(f"❌ 启动服务器失败: {e}")
            sys.exit(1)

if __name__ == "__main__":
    # 切换到脚本所在目录
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # 检查参数
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("❌ 端口号必须是数字")
            sys.exit(1)
    
    start_server(port)