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
        this.showLoading(true);
      };
      
      this.player.onLoadEnd = () => {
        this.showLoading(false);
      };
      
      this.player.onError = (error) => {
        this.showError(error);
      };
      
      this.player.onPlayStateChange = (playing) => {
        this.updatePlayButton(playing);
      };
      
      // 调整画布大小
      this.resizeCanvas();
      
      console.log('App initialized');
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError(error);
    }
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
   * 显示错误
   */
  showError(error) {
    console.error('Player error:', error);
    alert(`播放器错误: ${error.message || error}`);
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