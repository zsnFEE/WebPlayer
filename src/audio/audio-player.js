/**
 * 音频播放器
 */
export class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.workletNode = null;
    this.isInitialized = false;
    this.currentTime = 0;
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.playing = false;
    
    this.onTimeUpdate = null;
  }

  /**
   * 初始化音频播放器
   */
  async init() {
    try {
      // 创建音频上下文
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 如果音频上下文被暂停，需要用户交互来恢复
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 加载AudioWorklet处理器
      await this.audioContext.audioWorklet.addModule('/src/audio/audio-worklet-processor.js');
      
      // 创建AudioWorkletNode
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-worklet-processor', {
        outputChannelCount: [2]
      });

      // 连接到音频输出
      this.workletNode.connect(this.audioContext.destination);

      // 监听来自AudioWorklet的消息
      this.workletNode.port.onmessage = (event) => {
        this.handleWorkletMessage(event.data);
      };

      // 配置AudioWorklet
      this.workletNode.port.postMessage({
        type: 'config',
        sampleRate: this.audioContext.sampleRate,
        channelCount: 2
      });

      this.isInitialized = true;
      console.log('Audio player initialized, sample rate:', this.audioContext.sampleRate);
      
    } catch (error) {
      console.error('Failed to initialize audio player:', error);
      throw error;
    }
  }

  /**
   * 处理来自AudioWorklet的消息
   */
  handleWorkletMessage(data) {
    switch (data.type) {
      case 'time-update':
        this.currentTime = data.currentTime;
        if (this.onTimeUpdate) {
          this.onTimeUpdate(this.currentTime);
        }
        break;
    }
  }

  /**
   * 添加音频数据
   */
  addAudioData(buffer, timestamp) {
    if (!this.isInitialized) return;

    this.workletNode.port.postMessage({
      type: 'audio-data',
      buffer: buffer,
      timestamp: timestamp
    }, buffer instanceof SharedArrayBuffer ? [] : [buffer]);
  }

  /**
   * 播放
   */
  async play() {
    if (!this.isInitialized) return;

    // 确保音频上下文处于运行状态
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.playing = true;
    this.workletNode.port.postMessage({
      type: 'play'
    });
  }

  /**
   * 暂停
   */
  pause() {
    if (!this.isInitialized) return;

    this.playing = false;
    this.workletNode.port.postMessage({
      type: 'pause'
    });
  }

  /**
   * 设置音量 (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    if (this.isInitialized) {
      this.workletNode.port.postMessage({
        type: 'volume',
        volume: this.volume
      });
    }
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.1, Math.min(4, rate));
    
    if (this.isInitialized) {
      this.workletNode.port.postMessage({
        type: 'playback-rate',
        rate: this.playbackRate
      });
    }
  }

  /**
   * 跳转到指定时间
   */
  seek(time) {
    if (!this.isInitialized) return;

    this.currentTime = time;
    this.workletNode.port.postMessage({
      type: 'seek',
      time: time
    });
  }

  /**
   * 清除音频缓冲
   */
  clear() {
    if (!this.isInitialized) return;

    this.workletNode.port.postMessage({
      type: 'clear'
    });
  }

  /**
   * 获取当前播放时间
   */
  getCurrentTime() {
    return this.currentTime;
  }

  /**
   * 获取音频上下文状态
   */
  getState() {
    return {
      playing: this.playing,
      currentTime: this.currentTime,
      volume: this.volume,
      playbackRate: this.playbackRate,
      sampleRate: this.audioContext?.sampleRate || 0
    };
  }

  /**
   * 销毁音频播放器
   */
  destroy() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.isInitialized = false;
  }
}