// 简化版播放器 - 使用HTML5 Video作为核心
import './styles/main.css';

class SimplePlayer {
  constructor() {
    console.log('🎬 [SimplePlayer] 初始化...');
    this.initializeElements();
    this.setupEventListeners();
    this.video = null;
    this.isReady = false;
  }

  initializeElements() {
    // 获取DOM元素
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
    this.speedSelector = document.getElementById('speed-selector');
    this.loading = document.getElementById('loading');

    // 创建隐藏的video元素
    this.createVideoElement();
    
    console.log('✅ [SimplePlayer] DOM元素初始化完成');
  }

  createVideoElement() {
    // 创建video元素
    this.video = document.createElement('video');
    this.video.style.display = 'none';
    this.video.crossOrigin = 'anonymous';
    document.body.appendChild(this.video);

    // 设置video事件
    this.video.addEventListener('loadedmetadata', () => {
      console.log('✅ [SimplePlayer] 视频元数据加载完成');
      console.log(`时长: ${this.video.duration}秒`);
      console.log(`尺寸: ${this.video.videoWidth}x${this.video.videoHeight}`);
      
      this.isReady = true;
      this.hideLoading();
      this.enableControls();
      this.updateDuration(this.video.duration);
      this.startVideoRender();
    });

    this.video.addEventListener('timeupdate', () => {
      this.updateTime(this.video.currentTime);
    });

    this.video.addEventListener('play', () => {
      console.log('▶️ [SimplePlayer] 播放开始');
      this.updatePlayButton(true);
    });

    this.video.addEventListener('pause', () => {
      console.log('⏸️ [SimplePlayer] 播放暂停');
      this.updatePlayButton(false);
    });

    this.video.addEventListener('error', (e) => {
      console.error('❌ [SimplePlayer] 视频播放错误:', e);
      this.showError('视频播放失败');
    });

    console.log('✅ [SimplePlayer] Video元素创建完成');
  }

  setupEventListeners() {
    // 文件选择
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.loadFile(file);
      }
    });

    // URL加载
    if (this.loadUrlBtn) {
      this.loadUrlBtn.addEventListener('click', () => {
        this.loadURL();
      });
    }

    if (this.urlInput) {
      this.urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.loadURL();
        }
      });
    }

    // 播放控制
    this.playBtn.addEventListener('click', () => {
      this.togglePlay();
    });

    // 进度条
    this.progressContainer.addEventListener('click', (e) => {
      this.handleProgressClick(e);
    });

    // 音量控制
    this.volumeSlider.addEventListener('input', (e) => {
      const volume = e.target.value / 100;
      this.video.volume = volume;
    });

    // 速度控制
    this.speedSelector.addEventListener('change', (e) => {
      this.video.playbackRate = parseFloat(e.target.value);
    });

    console.log('✅ [SimplePlayer] 事件监听器设置完成');
  }

  async loadFile(file) {
    console.log('📁 [SimplePlayer] 开始加载文件:', file.name);
    
    try {
      this.showLoading();
      this.disableControls();

      // 使用URL.createObjectURL直接加载
      const videoUrl = URL.createObjectURL(file);
      this.video.src = videoUrl;
      
      console.log('✅ [SimplePlayer] 文件URL创建成功');
      
    } catch (error) {
      console.error('❌ [SimplePlayer] 文件加载失败:', error);
      this.hideLoading();
      this.showError(`文件加载失败: ${error.message}`);
    }
  }

  async loadURL() {
    const url = this.urlInput.value.trim();
    if (!url) {
      this.showError('请输入有效的视频URL');
      return;
    }

    console.log('🌐 [SimplePlayer] 开始加载URL:', url);
    
    try {
      this.showLoading();
      this.disableControls();
      this.loadUrlBtn.disabled = true;

      this.video.src = url;
      
      console.log('✅ [SimplePlayer] URL设置成功');
      
    } catch (error) {
      console.error('❌ [SimplePlayer] URL加载失败:', error);
      this.hideLoading();
      this.loadUrlBtn.disabled = false;
      this.showError(`网络视频加载失败: ${error.message}`);
    }
  }

  togglePlay() {
    console.log('🎮 [SimplePlayer] 切换播放状态');
    
    if (!this.isReady) {
      console.warn('⚠️ [SimplePlayer] 视频未就绪');
      return;
    }

    if (this.video.paused) {
      this.video.play().catch(error => {
        console.error('❌ [SimplePlayer] 播放失败:', error);
        this.showError(`播放失败: ${error.message}`);
      });
    } else {
      this.video.pause();
    }
  }

  handleProgressClick(e) {
    if (!this.isReady) return;

    const rect = this.progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    const targetTime = percentage * this.video.duration;
    
    this.video.currentTime = targetTime;
  }

  startVideoRender() {
    // 使用canvas渲染video
    const ctx = this.canvas.getContext('2d');
    
    const render = () => {
      if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
        // 计算适合的尺寸
        const canvasWidth = this.canvas.clientWidth;
        const canvasHeight = this.canvas.clientHeight;
        const videoAspect = this.video.videoWidth / this.video.videoHeight;
        const canvasAspect = canvasWidth / canvasHeight;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (videoAspect > canvasAspect) {
          drawWidth = canvasWidth;
          drawHeight = canvasWidth / videoAspect;
          drawX = 0;
          drawY = (canvasHeight - drawHeight) / 2;
        } else {
          drawWidth = canvasHeight * videoAspect;
          drawHeight = canvasHeight;
          drawX = (canvasWidth - drawWidth) / 2;
          drawY = 0;
        }

        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(this.video, drawX, drawY, drawWidth, drawHeight);
      }
      
      requestAnimationFrame(render);
    };
    
    render();
    console.log('✅ [SimplePlayer] 视频渲染开始');
  }

  updateTime(currentTime) {
    const duration = this.video.duration || 0;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    
    this.progressBar.style.width = `${progress}%`;
    this.timeDisplay.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
  }

  updateDuration(duration) {
    this.timeDisplay.textContent = `00:00 / ${this.formatTime(duration)}`;
  }

  updatePlayButton(playing) {
    this.playIcon.textContent = playing ? '⏸️' : '▶️';
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  showLoading() {
    this.loading.classList.remove('hidden');
  }

  hideLoading() {
    this.loading.classList.add('hidden');
  }

  enableControls() {
    this.playBtn.disabled = false;
    this.playBtn.style.opacity = '1';
    this.playBtn.style.pointerEvents = 'auto';
    this.progressContainer.style.pointerEvents = 'auto';
    this.volumeSlider.disabled = false;
    this.speedSelector.disabled = false;
    
    if (this.loadUrlBtn) {
      this.loadUrlBtn.disabled = !this.urlInput.value.trim();
    }
    
    console.log('✅ [SimplePlayer] 控件已启用');
  }

  disableControls() {
    this.playBtn.disabled = true;
    this.progressContainer.style.pointerEvents = 'none';
    this.volumeSlider.disabled = true;
    this.speedSelector.disabled = true;
    
    console.log('🔒 [SimplePlayer] 控件已禁用');
  }

  showError(message) {
    console.error('❌ [SimplePlayer] 错误:', message);
    alert(message); // 简单的错误显示
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 [SimplePlayer] DOM加载完成，启动应用...');
  new SimplePlayer();
});

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('🚨 [Global] 未处理错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 [Global] 未处理Promise拒绝:', event.reason);
});