# 🎬 WebAV播放器

现代化的Web音视频播放器，支持WebGPU、WebGL、AudioWorklet和WebCodecs等先进技术。

## 🚀 快速开始

```bash
# 一键启动
./start-webpack.sh

# 或手动启动
npm install
npm run dev
```

然后访问: http://localhost:9000

## ✨ 核心特性

### 🎬 视频播放
- 支持MP4 (H.264, H.265), WebM等格式
- WebGPU/WebGL硬件加速渲染
- OffscreenCanvas性能优化
- 自适应画质和分辨率

### 🔊 音频处理
- AudioWorklet高质量音频处理
- 多声道音频支持 (立体声/5.1/7.1)
- 虚拟环绕声效果
- 实时音量控制

### 🚀 高级功能
- 边下载边播放 (流式播放)
- 快速启动优化
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

- **构建工具**: Webpack 5 + Babel
- **渲染**: WebGPU → WebGL → Canvas 2D
- **音频**: AudioWorklet → Web Audio API
- **解码**: WebCodecs → FFmpeg.wasm
- **数据**: SharedArrayBuffer → ArrayBuffer
- **解析**: MP4Box.js + 自定义流解析器

## 📋 系统要求

- Node.js 16.0.0+
- npm 8.0.0+
- 现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

## 📦 npm 脚本

```bash
npm run dev         # 开发服务器
npm run build       # 生产构建
npm run build:dev   # 开发构建
npm run start       # 开发服务器(自动打开浏览器)
npm run clean       # 清理构建目录
npm run clean:all   # 清理所有文件
npm run reinstall   # 重新安装依赖
npm run serve       # 构建并预览
```

## 🏗️ 项目结构

```
webav-player/
├── src/
│   ├── main.js              # 应用入口
│   ├── player.js            # 主播放器类
│   ├── audio/               # 音频处理模块
│   │   ├── audio-player.js
│   │   └── audio-worklet-processor.js
│   ├── decoder/             # 解码器模块
│   │   ├── webcodecs-decoder.js
│   │   └── ffmpeg-decoder.js
│   ├── render/              # 渲染器模块
│   │   ├── webgpu-renderer.js
│   │   └── webgl-renderer.js
│   ├── parser/              # 解析器模块
│   │   └── mp4-parser.js
│   └── utils/               # 工具类
│       ├── shared-buffer.js
│       └── stream-loader.js
├── dist/                    # 构建输出
├── webpack.config.js        # Webpack配置
├── .babelrc                # Babel配置
├── package.json            # 项目配置
└── index.html              # HTML模板
```

## 🔧 开发指南

### 添加新功能
1. 在 `src/` 目录下创建模块
2. 在 `main.js` 中导入
3. Webpack自动处理依赖

### 调试
- 开发环境自动生成Source Maps
- 使用浏览器开发者工具调试
- 热重载支持代码实时更新

### 部署
```bash
npm run build
# 将 dist/ 目录部署到Web服务器
```

## 🐛 常见问题

**Q: 启动失败？**
```bash
npm run clean:all
npm install
```

**Q: 端口冲突？**
- 修改 `webpack.config.js` 中的 `port: 9000`

**Q: 构建错误？**
- 确保Node.js版本 >= 16.0.0
- 检查npm版本 >= 8.0.0

## 🎯 浏览器支持

| 功能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| WebCodecs | ✅ 94+ | 🔄 开发中 | ❌ | ✅ 94+ |
| WebGPU | ✅ 113+ | 🔄 开发中 | 🔄 开发中 | ✅ 113+ |
| AudioWorklet | ✅ 66+ | ✅ 76+ | ✅ 14.1+ | ✅ 79+ |
| SharedArrayBuffer | ✅ 68+ | ✅ 79+ | ✅ 15.2+ | ✅ 79+ |

## 📄 许可证

MIT License

---

**🎬 立即开始**: 运行 `./start-webpack.sh`