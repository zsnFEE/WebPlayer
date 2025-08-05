# WebAV Player

一个现代化的Web音视频播放器，基于最新的Web技术栈构建，支持高性能的音视频播放。

## 特性

### 🚀 现代技术栈
- **WebGPU/WebGL渲染**: 优先使用WebGPU，自动降级到WebGL
- **AudioWorklet音频**: 低延迟、高质量音频播放
- **WebCodecs解码**: 硬件加速解码，降级到FFmpeg.wasm
- **SharedArrayBuffer**: 高效的数据共享和管理

### 🎯 核心功能
- ✅ MP4文件支持
- ✅ 边下边解码边播放
- ✅ 快速起播
- ✅ 倍速播放 (0.5x - 2x)
- ✅ 音量调节
- ✅ 精确seek
- ✅ 流式加载
- ✅ 键盘快捷键

### 🎮 控制功能
- **播放/暂停**: 空格键或点击播放按钮
- **跳转**: 点击进度条或使用左右箭头键
- **音量**: 上下箭头键或拖动音量滑块
- **倍速**: 下拉菜单选择播放速度
- **静音**: M键切换静音

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 打开浏览器
访问 `http://localhost:5173`

### 4. 使用播放器
- 点击"选择音视频文件"按钮选择MP4文件
- 或将文件拖拽到页面上
- 等待加载完成后开始播放

## 技术架构

### 渲染层
```
WebGPU Renderer (首选)
    ↓ 降级
WebGL Renderer (后备)
```

### 解码层
```
WebCodecs Decoder (首选)
    ↓ 降级  
FFmpeg.wasm Decoder (后备)
```

### 音频链路
```
MP4Parser → AudioDecoder → SharedArrayBuffer → AudioWorklet → AudioContext
```

### 视频链路
```
MP4Parser → VideoDecoder → SharedArrayBuffer → Renderer → Canvas
```

## 项目结构

```
src/
├── audio/                  # 音频模块
│   ├── audio-player.js     # 音频播放器管理
│   └── audio-worklet-processor.js  # AudioWorklet处理器
├── decoder/                # 解码模块
│   ├── webcodecs-decoder.js    # WebCodecs解码器
│   └── ffmpeg-decoder.js       # FFmpeg.wasm解码器
├── parser/                 # 解析模块
│   └── mp4-parser.js       # MP4文件解析器
├── render/                 # 渲染模块
│   ├── webgpu-renderer.js  # WebGPU渲染器
│   └── webgl-renderer.js   # WebGL渲染器
├── utils/                  # 工具模块
│   └── shared-buffer.js    # SharedArrayBuffer管理
├── player.js              # 主播放器类
└── main.js               # 应用入口
```

## 浏览器支持

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| WebCodecs | ✅ 94+ | ❌ | ❌ | ✅ 94+ |
| WebGPU | ✅ 113+ | ❌ | ❌ | ✅ 113+ |
| AudioWorklet | ✅ 66+ | ✅ 76+ | ✅ 14.1+ | ✅ 79+ |
| SharedArrayBuffer | ✅ 68+ | ✅ 79+ | ✅ 15.2+ | ✅ 79+ |

### 推荐环境
- **最佳体验**: Chrome 113+ (支持所有特性)
- **良好体验**: Firefox 79+, Safari 15.2+ (部分特性降级)

## 开发说明

### 安全头设置
项目需要以下HTTP头以启用SharedArrayBuffer:
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

### 本地开发
Vite开发服务器已配置相应的安全头，无需额外设置。

### 生产部署
确保Web服务器配置了必要的安全头。

## API 文档

### WebAVPlayer 类

```javascript
const player = new WebAVPlayer(canvas);

// 加载媒体
await player.loadFile(file);

// 播放控制
await player.play();
player.pause();
player.seek(time);

// 音量和速度
player.setVolume(0.8);
player.setPlaybackRate(1.5);

// 事件监听
player.onTimeUpdate = (time) => console.log(time);
player.onDurationChange = (duration) => console.log(duration);
player.onError = (error) => console.error(error);
```

## 性能优化

### 1. 内存管理
- 使用SharedArrayBuffer减少数据拷贝
- 及时清理已使用的帧缓冲
- 限制队列大小防止内存溢出

### 2. 渲染优化
- WebGPU硬件加速渲染
- 适应性画布分辨率
- 帧率同步控制

### 3. 解码优化
- WebCodecs硬件解码
- 流式解析和解码
- 智能缓冲策略

## 已知问题

1. **WebCodecs支持**: 目前仅Chrome和Edge支持，其他浏览器降级到FFmpeg.wasm
2. **WebGPU支持**: 需要较新版本的Chrome
3. **SharedArrayBuffer**: 需要安全上下文(HTTPS)和适当的HTTP头

## 贡献指南

1. Fork项目
2. 创建特性分支
3. 提交变更
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License

## 更新日志

### v1.0.0
- 🎉 初始版本发布
- ✅ 完整的MP4播放支持
- ✅ WebGPU/WebGL双渲染器
- ✅ WebCodecs/FFmpeg双解码器
- ✅ AudioWorklet音频播放
- ✅ 完整的播放控制功能