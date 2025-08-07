// Import styles
import './styles/main.css';

// Webpack polyfills are handled in webpack.config.js
import { WebAVPlayer } from './player.js';

/**
 * 主应用程序
 */
class App {
  constructor() {
    this.player = null;
    this.setupGlobalErrorHandling();
    this.initializeElements();
    this.setupEventListeners();
    this.initializePlayer();
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    // 捕获未处理的错误
    window.addEventListener('error', (event) => {
      console.error('🚨 [Global] Unhandled error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      });
    });

    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      console.error('🚨 [Global] Unhandled promise rejection:', {
        reason: event.reason,
        promise: event.promise
      });
    });
  }

  /**
   * 初始化DOM元素
   */
  initializeElements() {
    this.canvas = document.getElementById('video-canvas');
    this.fileInput = document.getElementById('file-input');
    this.urlInput = document.getElementById('url-input');
    this.loadUrlBtn = document.getElementById('load-url-btn');
    this.playBtn = document.getElementById('play-btn');
    this.playIcon = document.getElementById('play-icon');
    this.progressContainer = document.getElementById('progress-container');
    this.progressBar = document.getElementById('progress-bar');
    this.timeDisplay = document.getElementById('time-display');
    this.volumeSlider = document.getElementById('volume-slider');
    this.volumeIcon = document.getElementById('volume-icon');
    this.speedSelector = document.getElementById('speed-selector');
    this.fullscreenBtn = document.getElementById('fullscreen-btn');
    this.loading = document.getElementById('loading');
    this.playerContainer = document.getElementById('player-container');
    this.playerHeader = document.getElementById('player-header');
    
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

    // URL加载按钮
    if (this.loadUrlBtn) {
      this.loadUrlBtn.addEventListener('click', () => {
        this.loadURL();
      });
    }

    // URL输入框回车键
    if (this.urlInput) {
      this.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.loadURL();
        }
      });
      
      // URL输入框变化时启用/禁用按钮
      this.urlInput.addEventListener('input', (e) => {
        if (this.loadUrlBtn) {
          this.loadUrlBtn.disabled = !e.target.value.trim();
        }
      });
    }

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

    // 音量图标点击切换静音
    if (this.volumeIcon) {
      this.volumeIcon.addEventListener('click', () => {
        this.toggleMute();
      });
    }

    // 速度控制
    this.speedSelector.addEventListener('change', (e) => {
      this.setPlaybackRate(parseFloat(e.target.value));
    });

    // 全屏控制
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    // 键盘控制
    document.addEventListener('keydown', (e) => {
      this.handleKeyboard(e);
    });

    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    // 鼠标移动控制UI显示/隐藏
    let hideTimeout;
    this.playerContainer.addEventListener('mousemove', () => {
      this.showUI();
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        this.hideUI();
      }, 3000);
    });

    // 双击全屏
    this.canvas.addEventListener('dblclick', () => {
      this.toggleFullscreen();
    });
  }

  /**
   * 初始化播放器
   */
  async initializePlayer() {
    try {
      console.log('Initializing WebAV Player...');
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

      // 媒体加载完成后的回调
      this.player.onMediaReady = () => {
        this.hideLoading();
        this.enableControls();
        console.log('Media ready, controls enabled');
      };
      
      // ★ 关键修复：初始化播放器组件
      await this.player.initialize();
      
      console.log('WebAV Player initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize WebAV Player:', error);
      this.handleError(error);
      throw error; // Re-throw to prevent further execution
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
    console.log('📁 [App] Starting loadFile process...');
    
    if (!this.player) {
      console.error('❌ [App] Player not initialized');
      this.showError('播放器未初始化');
      return;
    }

    try {
      console.log('📄 [App] File details:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified)
      });
      
      console.log('⏳ [App] Starting loading process...');
      this.showLoading();
      this.disableControls();
      
      console.log('🎬 [App] Calling player.loadFile...');
      await this.player.loadFile(file);
      
      console.log('✅ [App] File loaded successfully:', file.name);
      console.log('🎮 [App] Checking player state after load...');
      console.log('Player state:', {
        isPlaying: this.player.isPlaying,
        duration: this.player.duration,
        currentTime: this.player.currentTime,
        mediaInfo: this.player.mediaInfo,
        hasVideoDecoder: !!this.player.decoder,
        hasRenderer: !!this.player.renderer,
        hasParser: !!this.player.parser
      });
      
    } catch (error) {
      console.error('❌ [App] Failed to load file:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      this.hideLoading();
      
      // 提供更友好的错误信息
      let userMessage = `文件加载失败: ${error.message}`;
      if (error.message.includes('appendBuffer')) {
        userMessage = '文件格式不支持或文件已损坏，请选择有效的MP4视频文件';
      } else if (error.message.includes('MP4Box')) {
        userMessage = 'MP4解析器初始化失败，请刷新页面重试';
      }
      
      this.showError(userMessage);
    }
  }

  /**
   * 加载网络视频
   */
  async loadURL() {
    if (!this.player) {
      this.showError('播放器未初始化');
      return;
    }

    const url = this.urlInput.value.trim();
    if (!url) {
      this.showError('请输入有效的视频URL地址');
      return;
    }

    try {
      console.log('Loading URL:', url);
      this.showLoading();
      this.disableControls();
      this.loadUrlBtn.disabled = true;
      
      await this.player.loadFile(url);
      console.log('URL loaded successfully:', url);
    } catch (error) {
      console.error('Failed to load URL:', error);
      this.hideLoading();
      this.loadUrlBtn.disabled = false;
      
      // 提供更友好的错误信息
      let userMessage = `网络视频加载失败: ${error.message}`;
      if (error.message.includes('HTTP')) {
        userMessage = '无法访问该视频地址，请检查URL是否正确或网络连接';
      } else if (error.message.includes('CORS')) {
        userMessage = '该视频地址不允许跨域访问，请尝试其他视频源';
      } else if (error.message.includes('appendBuffer')) {
        userMessage = '视频格式不支持，请尝试MP4格式的视频地址';
      }
      
      this.showError(userMessage);
    }
  }

  /**
   * 切换播放/暂停
   */
  async togglePlay() {
    console.log('🎮 [App] togglePlay() called');
    
    if (!this.player) {
      console.error('❌ [App] No player available for togglePlay');
      return;
    }

    const state = this.player.getState();
    console.log('🎵 [App] Current player state:', state);
    
    try {
      if (state.playing) {
        console.log('⏸️ [App] Pausing playback...');
        this.player.pause();
      } else {
        console.log('▶️ [App] Starting playback...');
        await this.player.play();
      }
    } catch (error) {
      console.error('❌ [App] Error in togglePlay:', error);
      this.showError(`播放控制失败: ${error.message}`);
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
    if (this.playIcon) {
      this.playIcon.textContent = playing ? '⏸️' : '▶️';
    } else {
      this.playBtn.textContent = playing ? '⏸️' : '▶️';
    }
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
   * 启用控件
   */
  enableControls() {
    console.log('🎛️ [App] enableControls() called');
    
    this.playBtn.disabled = false;
    this.progressContainer.style.pointerEvents = 'auto';
    this.volumeSlider.disabled = false;
    this.speedSelector.disabled = false;
    if (this.fullscreenBtn) {
      this.fullscreenBtn.disabled = false;
    }
    if (this.loadUrlBtn) {
      this.loadUrlBtn.disabled = !this.urlInput.value.trim();
    }
    
    console.log('✅ [App] All controls enabled successfully');
    
    // 检查播放器状态
    if (this.player) {
      const state = this.player.getState();
      console.log('🎮 [App] Player state after enabling controls:', state);
    }
  }

  /**
   * 禁用控件
   */
  disableControls() {
    this.playBtn.disabled = true;
    this.progressContainer.style.pointerEvents = 'none';
    this.volumeSlider.disabled = true;
    this.speedSelector.disabled = true;
    if (this.fullscreenBtn) {
      this.fullscreenBtn.disabled = true;
    }
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
   * 切换静音
   */
  toggleMute() {
    if (this.player) {
      const currentVolume = this.volumeSlider.value / 100;
      if (currentVolume > 0) {
        this.lastVolume = currentVolume;
        this.setVolume(0);
        this.volumeSlider.value = 0;
        this.volumeIcon.textContent = '🔇';
      } else {
        const restoreVolume = this.lastVolume || 1;
        this.setVolume(restoreVolume);
        this.volumeSlider.value = restoreVolume * 100;
        this.volumeIcon.textContent = '🔊';
      }
    }
  }

  /**
   * 切换全屏
   */
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.playerContainer.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  /**
   * 显示UI
   */
  showUI() {
    this.playerHeader.classList.remove('hidden');
    this.playerContainer.style.cursor = 'default';
  }

  /**
   * 隐藏UI
   */
  hideUI() {
    if (document.fullscreenElement && this.player && this.player.isPlaying) {
      this.playerHeader.classList.add('hidden');
      this.playerContainer.style.cursor = 'none';
    }
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