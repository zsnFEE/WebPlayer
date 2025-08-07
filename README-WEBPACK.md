# 🚀 WebAV播放器 - Webpack版本

这是使用Webpack构建的WebAV播放器版本，替代了Vite构建工具，解决了各种兼容性问题。

## ✨ 特性

- 🔧 **Webpack 5** - 现代化的模块打包工具
- 🎯 **完善的Polyfills** - 自动处理Node.js模块在浏览器中的兼容性
- 🚀 **热重载** - 开发时自动刷新
- 📦 **代码分割** - 智能分包，优化加载性能
- 🔍 **Source Maps** - 便于调试
- 🌐 **CORS支持** - 内置跨域头部配置

## 🚀 快速开始

### 方法1: 使用启动脚本（推荐）
```bash
./start-webpack.sh
```

### 方法2: 手动启动
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 方法3: 生产构建
```bash
# 构建生产版本
npm run build

# 构建后的文件在 dist/ 目录中
```

## 📱 访问地址

- **开发服务器**: http://localhost:9000
- **生产构建**: 构建后可部署到任何Web服务器

## 🔧 项目结构

```
webav-player/
├── src/                    # 源代码目录
│   ├── main.js            # 入口文件
│   ├── player.js          # 主播放器类
│   ├── audio/             # 音频处理模块
│   ├── decoder/           # 解码器模块
│   ├── render/            # 渲染器模块
│   ├── parser/            # 解析器模块
│   └── utils/             # 工具类
├── dist/                  # 构建输出目录
├── webpack.config.js      # Webpack配置
├── .babelrc              # Babel配置
├── package.json          # 项目配置
└── index.html            # HTML模板
```

## 🛠️ 配置说明

### Webpack配置特性

- **Node.js Polyfills**: 自动为浏览器提供crypto、stream、buffer等Node.js模块的polyfills
- **代码分割**: 将FFmpeg、MP4Box等大型库分别打包
- **热重载**: 开发时代码变更自动刷新
- **资源优化**: 自动处理图片、字体、WASM等资源
- **CORS头部**: 自动添加必要的跨域和安全头部

### Babel配置特性

- **现代浏览器支持**: 针对Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **按需polyfill**: 只引入需要的polyfills，减小包体积
- **异步转换**: 支持async/await等现代JavaScript特性

## 📦 依赖说明

### 构建工具
- `webpack` - 模块打包器
- `webpack-dev-server` - 开发服务器
- `babel-loader` - JavaScript转换器
- `html-webpack-plugin` - HTML模板处理

### Polyfills
- `crypto-browserify` - 浏览器crypto模块
- `stream-browserify` - 浏览器stream模块
- `buffer` - Buffer polyfill
- `process` - Process polyfill
- `util` - Util模块

### 媒体处理
- `@ffmpeg/ffmpeg` - WebAssembly FFmpeg
- `@ffmpeg/util` - FFmpeg工具类
- `mp4box` - MP4解析库

## 🔄 与Vite版本的区别

| 特性 | Webpack版本 | Vite版本 |
|------|-------------|----------|
| 🔧 构建工具 | Webpack 5 | Vite 5 |
| 🚀 启动速度 | 快速 | 极快 |
| 📦 Polyfills | 自动处理 | 手动配置 |
| 🔥 热重载 | ✅ 稳定 | ✅ 更快 |
| 📊 包体积 | 优化良好 | 更小 |
| 🛠️ 配置复杂度 | 中等 | 简单 |
| 🔍 调试 | Source Maps | 原生支持 |
| 🌐 兼容性 | **更好** | 可能有问题 |

## 🎯 解决的问题

✅ **crypto.getRandomValues错误** - 通过webpack polyfills完美解决  
✅ **Node.js模块兼容性** - 自动转换为浏览器兼容版本  
✅ **模块加载问题** - Webpack处理所有模块依赖  
✅ **跨域问题** - 开发服务器自动添加CORS头部  
✅ **构建稳定性** - Webpack成熟稳定，生产环境验证  

## 🚀 性能优化

### 开发环境
- 热模块替换(HMR)
- 增量编译
- 内存文件系统
- Source Map支持

### 生产环境
- 代码分割
- Tree Shaking
- 资源压缩
- 长期缓存

## 🐛 故障排除

### 常见问题

**Q: 启动失败？**
```bash
# 清理依赖重新安装
npm run clean
npm install
```

**Q: 端口冲突？**
```bash
# 修改webpack.config.js中的port配置
port: 9001  // 改为其他端口
```

**Q: 编译错误？**
```bash
# 检查Node.js版本
node --version  # 需要 >= 16.0.0
```

**Q: 依赖安装失败？**
```bash
# 清理npm缓存
npm cache clean --force
npm install
```

## 🎮 开发指南

### 添加新功能
1. 在`src/`目录下创建新模块
2. 在`main.js`中导入
3. Webpack自动处理模块依赖

### 调试技巧
- 使用浏览器开发者工具
- Source Maps提供原始代码映射
- 控制台查看详细错误信息

### 部署指南
```bash
# 构建生产版本
npm run build

# 部署dist目录到Web服务器
cp -r dist/* /var/www/html/
```

## 🎯 下一步

- [ ] 添加TypeScript支持
- [ ] 集成ESLint代码检查
- [ ] 添加单元测试
- [ ] 优化包体积
- [ ] 添加PWA支持

---

**🎬 现在就开始使用吧！运行 `./start-webpack.sh` 或 `npm run dev`**