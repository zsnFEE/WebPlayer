/**
 * Webpack插件：修复FFmpeg动态导入警告
 */
class FFmpegFixPlugin {
  apply(compiler) {
    // 在编译完成后过滤掉FFmpeg相关的警告
    compiler.hooks.done.tap('FFmpegFixPlugin', (stats) => {
      if (stats.compilation && stats.compilation.warnings) {
        stats.compilation.warnings = stats.compilation.warnings.filter(warning => {
          const message = warning.message || warning.toString();
          
          // 过滤掉FFmpeg相关的Critical dependency警告
          if (message.includes('@ffmpeg') && message.includes('Critical dependency')) {
            return false;
          }
          
          // 过滤掉FFmpeg worker相关的动态导入警告
          if (message.includes('ffmpeg') && message.includes('the request of a dependency is an expression')) {
            return false;
          }
          
          return true;
        });
      }
    });
  }
}

module.exports = FFmpegFixPlugin;