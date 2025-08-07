# WebAV Player

现代化音视频播放器，支持本地文件和网络视频播放。

## 功能特点

- 🎬 **视频播放**: 支持MP4、H264、H265格式
- 🔊 **音频播放**: 多声道音频支持
- 🌐 **网络视频**: 支持HTTP/HTTPS视频URL
- ⚡ **硬件加速**: WebGPU/WebGL渲染，WebCodecs解码
- 🎛️ **完整控制**: 播放/暂停、进度控制、音量调节、倍速播放

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
访问: http://localhost:9000

### 生产构建
```bash
npm run build
```

## 使用方法

1. **本地文件**: 点击"选择本地文件"按钮上传视频
2. **网络视频**: 在URL输入框中输入视频地址，点击"加载网络视频"
3. **播放控制**: 使用播放按钮、进度条、音量滑块等控制播放

## 支持的格式

- **视频**: MP4 (H.264, H.265)
- **音频**: AAC, MP3
- **容器**: MP4

## 浏览器兼容性

- Chrome 94+
- Edge 94+
- Firefox 100+
- Safari 16+

需要支持 WebCodecs、WebGPU/WebGL、AudioWorklet 等现代Web API。

## 技术架构

- **渲染**: WebGPU (优先) → WebGL (降级) → Canvas 2D (保底)
- **解码**: WebCodecs (优先) → FFmpeg.wasm (降级)  
- **音频**: AudioWorklet + Web Audio API
- **解析**: MP4Box.js

## 项目结构

```
src/
├── main.js              # 主应用程序
├── player.js            # 核心播放器
├── render/              # 渲染器 (WebGPU/WebGL)
├── decoder/             # 解码器 (WebCodecs/FFmpeg)
├── audio/               # 音频播放器
├── parser/              # MP4解析器
└── styles/              # 样式文件
```

## 许可证

MIT License