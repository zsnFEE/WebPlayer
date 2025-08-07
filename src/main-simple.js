// 简化版本的main.js - 用于调试和诊断

// 首先加载简单polyfills
import './utils/simple-polyfills.js';

console.log('Main.js loaded, starting initialization...');

// 添加详细的错误捕获
window.addEventListener('error', (e) => {
  console.error('❌ Global Error:', e.message, 'at', e.filename + ':' + e.lineno);
  console.error('Stack:', e.error?.stack);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('❌ Unhandled Promise Rejection:', e.reason);
  console.error('Stack:', e.reason?.stack);
});

// 简单的应用类
class SimpleApp {
  constructor() {
    console.log('SimpleApp constructor called');
    this.canvas = null;
    this.player = null;
    this.init();
  }
  
  init() {
    try {
      console.log('Initializing SimpleApp...');
      
      // 等待DOM加载
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initDOM());
      } else {
        this.initDOM();
      }
      
    } catch (error) {
      console.error('SimpleApp init failed:', error);
    }
  }
  
  initDOM() {
    try {
      console.log('DOM ready, initializing elements...');
      
      this.canvas = document.getElementById('video-canvas');
      if (!this.canvas) {
        console.error('Canvas not found!');
        return;
      }
      
      console.log('Canvas found:', this.canvas);
      
      // 延迟加载播放器
      setTimeout(() => this.loadPlayer(), 100);
      
    } catch (error) {
      console.error('DOM init failed:', error);
    }
  }
  
  async loadPlayer() {
    try {
      console.log('Loading WebAVPlayer...');
      
      const playerModule = await import('./player.js');
      console.log('Player module loaded:', playerModule);
      
      if (typeof playerModule.WebAVPlayer !== 'function') {
        throw new Error('WebAVPlayer is not a function');
      }
      
      console.log('Creating WebAVPlayer instance...');
      this.player = new playerModule.WebAVPlayer(this.canvas);
      
      console.log('✅ WebAVPlayer created successfully!');
      
      // 设置基本事件
      this.player.onError = (error) => {
        console.error('Player error:', error);
      };
      
    } catch (error) {
      console.error('❌ Failed to load player:', error);
      console.error('Error stack:', error.stack);
    }
  }
}

// 确保所有内容都加载后再初始化
console.log('Creating SimpleApp...');
const app = new SimpleApp();

// 导出用于调试
window.debugApp = app;