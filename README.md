# 🎬 WebAV播放器 - 多版本解决方案

一个现代化的Web音视频播放器，支持WebGPU、WebGL、AudioWorklet和WebCodecs等先进技术。

## 🚀 三种使用方式

我们提供了三个不同的版本，您可以根据需求和环境选择：

### 1. 🔧 Webpack版本（推荐 - 解决兼容性问题）

**适合**: 需要稳定构建环境，解决crypto/polyfill问题

```bash
./start-webpack.sh
# 或
npm run dev
```

**访问**: http://localhost:9000

**特点**:
- ✅ 完美解决crypto.getRandomValues错误
- ✅ 自动处理所有Node.js polyfills
- ✅ 稳定的热重载和调试
- ✅ 成熟的生产环境支持

### 2. 🎯 原生版本（最简单 - 零依赖）

**适合**: 快速测试，避免Node.js/npm问题

```bash
./quick-start.sh
# 或
python3 -m http.server 8080
```

**访问**: http://localhost:8080/native-player.html

**特点**:
- ✅ 无需Node.js，只要Python 3
- ✅ 秒级启动，无需构建
- ✅ 纯HTML5，最大兼容性
- ✅ 零配置，开箱即用

### 3. ⚡ Vite版本（开发中 - 可能有兼容性问题）

**适合**: 熟悉Vite且环境配置正确的开发者

```bash
npm run dev  # 如果可以正常启动
```

**注意**: 该版本可能遇到crypto相关错误，建议使用上面两个版本

## 🎯 版本对比

| 特性 | Webpack版本 | 原生版本 | Vite版本 |
|------|-------------|----------|----------|
| 🚀 启动速度 | 快速 | **极快** | 很快 |
| 📦 依赖要求 | Node.js + npm | **仅Python 3** | Node.js + npm |
| 🔧 构建过程 | 需要构建 | **无需构建** | 需要构建 |
| 🛠️ 配置复杂度 | 中等 | **极简** | 简单 |
| 🔍 调试能力 | **优秀** | 基础 | 优秀 |
| 🌐 兼容性 | **优秀** | **优秀** | 可能有问题 |
| 📊 包体积 | 优化 | **最小** | 最优 |
| 🔥 热重载 | ✅ | ❌ | ✅ |
| 🎯 生产环境 | **推荐** | 可用 | 需要修复 |

## 🎮 功能特性

### 🎬 视频播放
- 支持MP4 (H.264, H.265), WebM, OGV等格式
- WebGPU/WebGL硬件加速渲染
- OffscreenCanvas优化性能
- 自适应画质和分辨率

### 🔊 音频处理
- AudioWorklet高质量音频处理
- 多声道音频支持 (单声道/立体声/5.1/7.1)
- 虚拟环绕声效果
- 实时音量和均衡器控制

### 🚀 高级特性
- 边下载边播放流式播放
- 快速启动优化 (moov box前置)
- WebCodecs硬件解码
- FFmpeg.wasm软件解码后备
- SharedArrayBuffer数据优化

### 🎛️ 播放控制
- 播放/暂停/停止
- 进度条拖拽定位
- 倍速播放 (0.25x - 4x)
- 音量控制和静音
- 全屏播放支持

## 🛠️ 技术栈

- **渲染**: WebGPU → WebGL → Canvas 2D
- **音频**: AudioWorklet → Web Audio API
- **解码**: WebCodecs → FFmpeg.wasm
- **数据**: SharedArrayBuffer → ArrayBuffer
- **解析**: MP4Box.js, 自定义流解析器

## 📋 系统要求

### 基础要求
- 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Webpack版本
- Node.js 16.0.0+
- npm 8.0.0+

### 原生版本
- Python 3.x (系统通常自带)

## 🚀 快速开始指南

### 第一次使用 - 推荐流程

1. **如果您遇到了Vite相关错误**:
   ```bash
   # 使用原生版本快速验证功能
   ./quick-start.sh
   ```

2. **如果需要完整开发环境**:
   ```bash
   # 使用Webpack版本
   ./start-webpack.sh
   ```

3. **如果只是想快速测试**:
   ```bash
   # 原生版本，无需任何依赖
   python3 -m http.server 8080
   # 然后访问 http://localhost:8080/native-player.html
   ```

## 🐛 故障排除

### crypto.getRandomValues错误
```bash
# 解决方案1: 使用Webpack版本
./start-webpack.sh

# 解决方案2: 使用原生版本
./quick-start.sh
```

### npm install失败
```bash
# 清理并重新安装
npm run clean
npm install

# 或者直接使用原生版本
./quick-start.sh
```

### 端口冲突
- Webpack版本: 修改`webpack.config.js`中的port
- 原生版本: 使用不同端口 `python3 -m http.server 8081`

## 📁 项目结构

```
webav-player/
├── src/                     # 源代码
│   ├── main.js             # 应用入口
│   ├── player.js           # 主播放器
│   ├── audio/              # 音频模块
│   ├── decoder/            # 解码模块
│   ├── render/             # 渲染模块
│   ├── parser/             # 解析模块
│   └── utils/              # 工具类
├── webpack.config.js       # Webpack配置
├── .babelrc               # Babel配置
├── native-player.html     # 原生版本
├── start-webpack.sh       # Webpack启动脚本
├── quick-start.sh        # 原生版本启动脚本
└── README-*.md           # 各版本详细说明
```

## 📚 详细文档

- [Webpack版本说明](./README-WEBPACK.md)
- [原生版本说明](./README-NATIVE.md)

## 🎯 推荐使用场景

- **🔧 开发和生产**: Webpack版本
- **🚀 快速演示**: 原生版本  
- **⚡ 实验性功能**: Vite版本（需要修复）

---

**🎬 立即开始**: 运行 `./start-webpack.sh` 或 `./quick-start.sh`