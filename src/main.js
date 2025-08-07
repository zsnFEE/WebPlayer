// 首先加载polyfills修复浏览器兼容性问题
import './utils/polyfills.js';

import { WebAVPlayer } from './player.js';

/**
 * 主应用程序
 */
class App {
  constructor() {
    this.player = null;
    this.initializeElements();
    this.setupEventListeners();
    this.initializePlayer();
  }

  /**
   * 初始化DOM元素
   */
  initializeElements() {
    this.canvas = document.getElementById('video-canvas');
    this.fileInput = document.getElementById('file-input');
    this.playBtn = document.getElementById('play-btn');
    this.progressContainer = document.getElementById('progress-container');
    this.progressBar = document.getElementById('progress-bar');
    this.timeDisplay = document.getElementById('time-display');
    this.volumeSlider = document.getElementById('volume-slider');
    this.speedSelector = document.getElementById('speed-selector');
    this.loading = document.getElementById('loading');
    
    // 验证关键元素是否存在
    if (!this.canvas) {
      console.error('Video canvas not found');
      return;
    }
    
    console.log('DOM elements initialized successfully');
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 文件选择
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.loadFile(file);
      }
    });

    // 播放/暂停按钮
    this.playBtn.addEventListener('click', () => {
      this.togglePlay();
    });

    // 进度条点击
    this.progressContainer.addEventListener('click', (e) => {
      this.handleProgressClick(e);
    });

    // 音量控制
    this.volumeSlider.addEventListener('input', (e) => {
      this.setVolume(e.target.value / 100);
    });

    // 速度控制
    this.speedSelector.addEventListener('change', (e) => {
      this.setPlaybackRate(parseFloat(e.target.value));
    });

    // 键盘控制
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  /**
   * 初始化播放器
   */
  async initializePlayer() {
    try {
      this.player = new WebAVPlayer(this.canvas);
      
      // 设置播放器事件回调
      this.player.onTimeUpdate = (time) => {
        this.updateTime(time);
      };
      
      this.player.onDurationChange = (duration) => {
        this.updateDuration(duration);
      };
      
      this.player.onLoadStart = () => {
        this.showLoading();
      };
      
      this.player.onLoadEnd = () => {
        this.hideLoading();
      };
      
      this.player.onPlayStateChange = (playing) => {
        this.updatePlayButton(playing);
      };
      
      this.player.onError = (error) => {
        this.handleError(error);
      };
      
      console.log('App initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.handleError(error);
    }
  }

  /**
   * 处理错误
   */
  handleError(error) {
    console.error('Player error:', error);
    
    // 显示用户友好的错误信息
    let userMessage = '播放器初始化失败';
    
    if (error.message.includes('AudioContext') || error.message.includes('audio')) {
      userMessage = '音频初始化失败，请点击页面任意位置后重试';
      
      // 添加点击监听器以在用户交互后重新初始化音频
      const retryAudio = async () => {
        try {
          if (this.player && this.player.audioPlayer) {
            await this.player.audioPlayer.init();
            document.removeEventListener('click', retryAudio);
            console.log('Audio context resumed after user interaction');
          }
        } catch (retryError) {
          console.error('Failed to retry audio initialization:', retryError);
        }
      };
      
      document.addEventListener('click', retryAudio, { once: true });
    } else if (error.message.includes('WebGPU') || error.message.includes('WebGL')) {
      userMessage = '图形渲染初始化失败，请使用支持现代Web标准的浏览器';
    } else if (error.message.includes('decoder')) {
      userMessage = '视频解码器初始化失败，某些格式可能不被支持';
    }
    
    this.showError(userMessage);
  }

  /**
   * 显示错误信息
   */
  showError(message) {
    // 创建错误提示元素
    let errorElement = document.getElementById('error-message');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'error-message';
      errorElement.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 400px;
        text-align: center;
        z-index: 1000;
      `;
      document.body.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    
    // 5秒后自动隐藏
    setTimeout(() => {
      if (errorElement) {
        errorElement.classList.add('hidden');
      }
    }, 5000);
  }

  /**
   * 加载文件
   */
  async loadFile(file) {
    try {
      await this.player.loadFile(file);
      console.log('File loaded:', file.name);
    } catch (error) {
      console.error('Failed to load file:', error);
      this.showError(error);
    }
  }

  /**
   * 切换播放/暂停
   */
  async togglePlay() {
    if (!this.player) return;

    const state = this.player.getState();
    
    if (state.playing) {
      this.player.pause();
    } else {
      await this.player.play();
    }
  }

  /**
   * 处理进度条点击
   */
  handleProgressClick(e) {
    if (!this.player) return;

    const rect = this.progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    
    const state = this.player.getState();
    const targetTime = percentage * state.duration;
    
    this.player.seek(targetTime);
  }

  /**
   * 设置音量
   */
  setVolume(volume) {
    if (this.player) {
      this.player.setVolume(volume);
    }
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate) {
    if (this.player) {
      this.player.setPlaybackRate(rate);
    }
  }

  /**
   * 处理键盘事件
   */
  handleKeyboard(e) {
    if (!this.player) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePlay();
        break;
        
      case 'ArrowLeft':
        e.preventDefault();
        this.seek(-10); // 后退10秒
        break;
        
      case 'ArrowRight':
        e.preventDefault();
        this.seek(10); // 前进10秒
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.adjustVolume(0.1); // 增加音量
        break;
        
      case 'ArrowDown':
        e.preventDefault();
        this.adjustVolume(-0.1); // 减少音量
        break;
        
      case 'KeyM':
        e.preventDefault();
        this.toggleMute(); // 静音切换
        break;
    }
  }

  /**
   * 相对跳转
   */
  seek(offset) {
    const state = this.player.getState();
    const newTime = Math.max(0, Math.min(state.currentTime + offset, state.duration));
    this.player.seek(newTime);
  }

  /**
   * 调整音量
   */
  adjustVolume(delta) {
    const state = this.player.getState();
    const newVolume = Math.max(0, Math.min(1, state.volume + delta));
    this.setVolume(newVolume);
    this.volumeSlider.value = newVolume * 100;
  }

  /**
   * 静音切换
   */
  toggleMute() {
    const state = this.player.getState();
    if (state.volume > 0) {
      this.lastVolume = state.volume;
      this.setVolume(0);
      this.volumeSlider.value = 0;
    } else {
      const volume = this.lastVolume || 1;
      this.setVolume(volume);
      this.volumeSlider.value = volume * 100;
    }
  }

  /**
   * 更新时间显示
   */
  updateTime(currentTime) {
    const state = this.player.getState();
    
    // 更新进度条
    if (state.duration > 0) {
      const percentage = (currentTime / state.duration) * 100;
      this.progressBar.style.width = `${percentage}%`;
    }
    
    // 更新时间文本
    const current = this.formatTime(currentTime);
    const total = this.formatTime(state.duration);
    this.timeDisplay.textContent = `${current} / ${total}`;
  }

  /**
   * 更新持续时间
   */
  updateDuration(duration) {
    const current = this.formatTime(this.player.getCurrentTime());
    const total = this.formatTime(duration);
    this.timeDisplay.textContent = `${current} / ${total}`;
  }

  /**
   * 更新播放按钮
   */
  updatePlayButton(playing) {
    this.playBtn.textContent = playing ? '⏸' : '▶';
  }

  /**
   * 显示/隐藏加载状态
   */
  showLoading(show) {
    this.loading.classList.toggle('hidden', !show);
  }

  /**
   * 隐藏加载状态
   */
  hideLoading() {
    this.loading.classList.add('hidden');
  }

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) {
      return '00:00';
    }
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 调整画布大小
   */
  resizeCanvas() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    // 设置画布显示大小
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    
    // 设置画布实际大小 (可以不同于显示大小以优化性能)
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // 通知渲染器更新大小
    if (this.player && this.player.renderer) {
      this.player.renderer.resize(this.canvas.width, this.canvas.height);
    }
  }

  /**
   * 销毁应用
   */
  destroy() {
    if (this.player) {
      this.player.destroy();
    }
  }
}

// 创建应用实例
let app;

// 等待DOM加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app = new App();
  });
} else {
  app = new App();
}

// 导出以便调试
window.app = app;