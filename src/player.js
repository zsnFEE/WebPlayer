import { WebGPURenderer } from './render/webgpu-renderer.js';
import { WebGLRenderer } from './render/webgl-renderer.js';
import { AudioPlayer } from './audio/audio-player.js';
import { WebCodecsDecoder } from './decoder/webcodecs-decoder.js';
import { FFmpegDecoder } from './decoder/ffmpeg-decoder.js';
import { MP4Parser } from './parser/mp4-parser.js';
import { sharedBufferManager } from './utils/shared-buffer.js';

/**
 * 主播放器类 - 完整功能版本
 * 支持：流式播放、快速起播、多声道音频、H264/H265、OffscreenCanvas
 */
export class WebAVPlayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;
    this.audioPlayer = new AudioPlayer();
    this.decoder = null;
    this.parser = new MP4Parser();
    
    // 播放状态
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.mediaInfo = null;
    
    // 流式播放和缓冲
    this.isLoading = false;
    this.isStreaming = false;
    this.fastStartEnabled = false;
    this.minBufferForPlay = 2.0; // 2秒缓冲
    this.videoFrameQueue = [];
    this.audioFrameQueue = [];
    this.maxVideoQueue = 30; // 最多缓存30帧视频
    this.maxAudioQueue = 50; // 最多缓存50帧音频
    
    // 时间同步
    this.lastVideoTime = 0;
    this.lastAudioTime = 0;
    this.startTime = 0;
    this.pausedTime = 0;
    
    // 多声道支持
    this.audioChannels = 2;
    this.channelLayout = 'stereo';
    this.surroundSound = false;
    
    // 事件回调
    this.onTimeUpdate = null;
    this.onDurationChange = null;
    this.onLoadStart = null;
    this.onLoadEnd = null;
    this.onError = null;
    this.onPlayStateChange = null;
    this.onBufferingStart = null;
    this.onBufferingEnd = null;
    this.onFastStartReady = null;
    
    // 性能监控
    this.stats = {
      framesDecoded: 0,
      framesDropped: 0,
      audioSamplesDecoded: 0,
      bufferHealth: 0,
      renderFps: 0,
      bitrateKbps: 0
    };
    
    // 质量自适应
    this.adaptiveQuality = true;
    this.targetLatency = 100; // 100ms目标延迟
    
    this.initialize();
  }

  /**
   * 初始化播放器
   */
  async initialize() {
    try {
      // 初始化渲染器 (优先WebGPU)
      await this.initRenderer();
      
      // 初始化音频播放器
      await this.audioPlayer.init();
      
      // 初始化解码器 (优先WebCodecs)
      await this.initDecoder();
      
      // 设置解析器回调
      await this.setupParserCallbacks();
      
      // 设置音频播放器回调
      this.setupAudioCallbacks();
      
      // 启动性能监控
      this.startPerformanceMonitoring();
      
      console.log('WebAV Player initialized successfully with enhanced features');
      
    } catch (error) {
      console.error('Failed to initialize player:', error);
      
      // 尝试提供有用的错误信息
      let errorMessage = 'Failed to initialize player';
      
      if (error.message.includes('WebGPU') && error.message.includes('WebGL')) {
        errorMessage = 'No supported rendering engine found. Please use a modern browser.';
      } else if (error.message.includes('AudioWorklet')) {
        errorMessage = 'Audio initialization failed. Please check browser audio permissions.';
      } else if (error.message.includes('decoder')) {
        errorMessage = 'Video decoder initialization failed. Some codecs may not be supported.';
      }
      
      if (this.onError) {
        this.onError(new Error(errorMessage));
      }
      
      throw error;
    }
  }

  /**
   * 初始化渲染器
   */
  async initRenderer() {
    try {
      // 尝试使用WebGPU
      this.renderer = new WebGPURenderer(this.canvas);
      await this.renderer.init();
      console.log('Using WebGPU renderer');
    } catch (error) {
      console.warn('WebGPU failed, falling back to WebGL:', error);
      
      try {
        // 后备到WebGL
        this.renderer = new WebGLRenderer(this.canvas);
        await this.renderer.init();
        console.log('Using WebGL renderer');
      } catch (webglError) {
        console.error('Both WebGPU and WebGL failed:', webglError);
        throw new Error('No supported renderer available');
      }
    }
  }

  /**
   * 初始化解码器
   */
  async initDecoder() {
    let webcodecsError = null;
    let ffmpegError = null;
    
    try {
      // 尝试使用WebCodecs
      this.decoder = new WebCodecsDecoder();
      
      // WebCodecs解码器不需要async初始化，但需要检查支持
      if (!this.decoder.isVideoSupported && !this.decoder.isAudioSupported) {
        throw new Error('WebCodecs not supported for video or audio');
      }
      
      console.log('Using WebCodecs decoder');
    } catch (error) {
      webcodecsError = error;
      console.warn('WebCodecs failed, falling back to FFmpeg:', error);
      
      try {
        // 后备到FFmpeg.wasm
        this.decoder = new FFmpegDecoder();
        await this.decoder.init();
        console.log('Using FFmpeg decoder');
      } catch (ffmpegError) {
        console.error('Both WebCodecs and FFmpeg failed:', ffmpegError);
        
        // 如果两个都失败了，抛出更详细的错误
        const detailedError = new Error(
          `No supported decoder available. WebCodecs: ${webcodecsError?.message || 'not supported'}. FFmpeg: ${ffmpegError?.message || 'failed to load'}`
        );
        
        throw detailedError;
      }
    }
    
    // 设置解码器回调
    this.decoder.onVideoFrame = (frame) => {
      this.handleVideoFrame(frame);
    };
    
    this.decoder.onAudioFrame = (frame) => {
      this.handleAudioFrame(frame);
    };
  }

  /**
   * 设置解析器回调 - 增强版
   */
  async setupParserCallbacks() {
    // 首先初始化解析器
    await this.parser.init();
    
    this.parser.onReady = (info) => {
      this.handleMediaReady(info);
    };
    
    this.parser.onSamples = (trackId, samples) => {
      this.handleSamples(trackId, samples);
    };
    
    this.parser.onError = (error) => {
      if (this.onError) {
        this.onError(error);
      }
    };
    
    // 流式播放回调
    this.parser.onProgress = (loaded, total) => {
      this.updateLoadingProgress(loaded, total);
    };
    
    this.parser.onFastStartReady = () => {
      this.handleFastStartReady();
    };
  }

  /**
   * 处理快速起播就绪
   */
  handleFastStartReady() {
    this.fastStartEnabled = true;
    console.log('Fast start ready - can begin playback');
    
    if (this.onFastStartReady) {
      this.onFastStartReady();
    }
    
    // 如果已经开始播放，继续处理
    if (this.isPlaying) {
      this.resumePlayback();
    }
  }

  /**
   * 处理媒体信息就绪 - 增强版
   */
  handleMediaReady(info) {
    this.mediaInfo = info;
    this.duration = info.duration / info.timescale;
    this.isStreaming = info.isStreaming || false;
    
    // 设置音频信息
    if (info.hasAudio && this.parser.audioTrack) {
      const audioTrack = this.parser.audioTrack;
      this.audioChannels = audioTrack.audio?.channel_count || 2;
      this.setupAudioChannels();
    }
    
    // 开始解码器初始化
    this.initDecodersWithMediaInfo();
    
    if (this.onDurationChange) {
      this.onDurationChange(this.duration);
    }
    
    console.log('Media ready:', {
      duration: this.duration,
      hasVideo: info.hasVideo,
      hasAudio: info.hasAudio,
      isStreaming: this.isStreaming,
      audioChannels: this.audioChannels
    });
  }

  /**
   * 设置音频声道
   */
  setupAudioChannels() {
    // 根据声道数确定布局
    switch (this.audioChannels) {
      case 1:
        this.channelLayout = 'mono';
        break;
      case 2:
        this.channelLayout = 'stereo';
        break;
      case 6:
        this.channelLayout = '5.1';
        this.surroundSound = true;
        break;
      case 8:
        this.channelLayout = '7.1';
        this.surroundSound = true;
        break;
      default:
        this.channelLayout = 'stereo';
        this.audioChannels = 2;
    }
    
    // 配置AudioWorklet
    this.audioPlayer.workletNode?.port.postMessage({
      type: 'channel-mapping',
      mapping: this.channelLayout
    });
    
    this.audioPlayer.workletNode?.port.postMessage({
      type: 'surround-mode',
      enabled: this.surroundSound
    });
    
    console.log(`Audio setup: ${this.audioChannels} channels, ${this.channelLayout} layout`);
  }

  /**
   * 使用媒体信息初始化解码器
   */
  async initDecodersWithMediaInfo() {
    if (!this.mediaInfo) return;
    
    try {
      // 初始化视频解码器
      if (this.mediaInfo.hasVideo && this.parser.videoTrack) {
        const videoConfig = this.createVideoConfig();
        await this.decoder.initVideoDecoder(videoConfig);
      }
      
      // 初始化音频解码器
      if (this.mediaInfo.hasAudio && this.parser.audioTrack) {
        const audioConfig = this.createAudioConfig();
        await this.decoder.initAudioDecoder(audioConfig);
      }
      
      console.log('Decoders initialized with media info');
      
    } catch (error) {
      console.error('Failed to initialize decoders with media info:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * 创建视频配置
   */
  createVideoConfig() {
    const track = this.parser.videoTrack;
    
    return {
      codec: track.codec,
      codedWidth: track.video.width,
      codedHeight: track.video.height,
      description: track.avcDecoderConfigRecord || track.hvcDecoderConfigRecord,
      hardwareAcceleration: 'prefer-hardware',
      optimizeForLatency: true
    };
  }

  /**
   * 创建音频配置
   */
  createAudioConfig() {
    const track = this.parser.audioTrack;
    
    return {
      codec: track.codec,
      sampleRate: track.audio.sample_rate,
      numberOfChannels: track.audio.channel_count,
      description: track.esdsBox?.data
    };
  }

  /**
   * 加载媒体文件
   */
  async loadFile(file) {
    this.reset();
    this.setLoading(true);
    
    try {
      if (file instanceof File) {
        // 本地文件
        await this.loadLocalFile(file);
      } else if (typeof file === 'string') {
        // URL
        await this.loadFromURL(file);
      } else {
        throw new Error('Unsupported file type');
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      this.setLoading(false);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * 加载本地文件
   */
  async loadLocalFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    this.parser.appendBuffer(arrayBuffer);
    this.parser.start();
  }

  /**
   * 从URL加载 (支持流式)
   */
  async loadFromURL(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // 流式添加数据
        this.parser.appendBuffer(value.buffer);
        
        // 如果还没开始，尝试开始解析
        if (!this.parser.isInitialized && this.parser.info) {
          this.parser.start();
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 处理媒体就绪
   */
  async handleMediaReady(info) {
    this.mediaInfo = info;
    this.duration = info.duration;
    
    console.log('Media ready:', info);
    
    if (this.onDurationChange) {
      this.onDurationChange(this.duration);
    }

    // 初始化解码器
    try {
      if (info.hasVideo && this.decoder instanceof WebCodecsDecoder) {
        const videoConfig = this.parser.getVideoDecoderConfig();
        if (videoConfig) {
          await this.decoder.initVideoDecoder(videoConfig);
        }
      }
      
      if (info.hasAudio && this.decoder instanceof WebCodecsDecoder) {
        const audioConfig = this.parser.getAudioDecoderConfig();
        if (audioConfig) {
          await this.decoder.initAudioDecoder(audioConfig);
        }
      }
    } catch (error) {
      console.error('Failed to initialize decoders:', error);
    }
    
    this.setLoading(false);
  }

  /**
   * 处理样本数据
   */
  handleSamples(trackId, samples) {
    for (const sample of samples) {
      const sampleData = this.parser.getSampleData(sample);
      
      if (trackId === this.parser.videoTrack?.id) {
        // 视频样本
        this.decoder.decodeVideo(
          sampleData.data,
          sampleData.timestamp,
          sampleData.isSync
        );
      } else if (trackId === this.parser.audioTrack?.id) {
        // 音频样本
        this.decoder.decodeAudio(
          sampleData.data,
          sampleData.timestamp
        );
      }
    }
  }

  /**
   * 处理视频帧
   */
  handleVideoFrame(frame) {
    this.stats.framesDecoded++;
    
    // 使用SharedArrayBuffer存储帧数据
    const frameBuffer = sharedBufferManager.createVideoFrameBuffer(
      frame.width,
      frame.height
    );
    
    frameBuffer.view.set(frame.data);
    
    // 添加到队列
    this.videoFrameQueue.push({
      buffer: frameBuffer,
      timestamp: frame.timestamp,
      width: frame.width,
      height: frame.height
    });
    
    // 渲染帧 (简化版本，实际应该有时序控制)
    this.renderCurrentFrame();
  }

  /**
   * 处理音频帧
   */
  handleAudioFrame(frame) {
    this.stats.audioSamplesDecoded += frame.data.length;
    
    // 使用SharedArrayBuffer存储音频数据
    const audioBuffer = sharedBufferManager.createAudioFrameBuffer(
      frame.data.length / frame.channelCount,
      frame.channelCount
    );
    
    audioBuffer.view.set(frame.data);
    
    // 发送到音频播放器
    this.audioPlayer.addAudioData(audioBuffer.buffer, frame.timestamp);
  }

  /**
   * 渲染当前帧
   */
  renderCurrentFrame() {
    if (this.videoFrameQueue.length === 0) return;
    
    // 简化版本：渲染最新帧
    const frame = this.videoFrameQueue.shift();
    
    if (this.renderer && frame) {
      this.renderer.renderFrame(
        frame.buffer.view,
        frame.width,
        frame.height
      );
      
      // 清理已使用的缓冲区
      sharedBufferManager.removeBuffer(frame.buffer.id);
    }
  }

  /**
   * 播放
   */
  async play() {
    if (!this.mediaInfo) {
      console.warn('No media loaded');
      return;
    }

    this.isPlaying = true;
    await this.audioPlayer.play();
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }
  }

  /**
   * 暂停
   */
  pause() {
    this.isPlaying = false;
    this.audioPlayer.pause();
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
  }

  /**
   * 跳转
   */
  seek(time) {
    if (!this.mediaInfo) return;
    
    time = Math.max(0, Math.min(time, this.duration));
    this.currentTime = time;
    
    // 清除队列
    this.videoFrameQueue = [];
    this.audioPlayer.clear();
    
    // 解析器跳转
    this.parser.seek(time);
    
    // 音频播放器跳转
    this.audioPlayer.seek(time);
  }

  /**
   * 设置音量
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.audioPlayer.setVolume(this.volume);
  }

  /**
   * 设置播放速度
   */
  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.1, Math.min(4, rate));
    this.audioPlayer.setPlaybackRate(this.playbackRate);
  }

  /**
   * 获取播放状态
   */
  getState() {
    return {
      playing: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      playbackRate: this.playbackRate,
      loading: this.isLoading,
      mediaInfo: this.mediaInfo,
      stats: this.stats
    };
  }

  /**
   * 设置加载状态
   */
  setLoading(loading) {
    this.isLoading = loading;
    
    if (loading && this.onLoadStart) {
      this.onLoadStart();
    } else if (!loading && this.onLoadEnd) {
      this.onLoadEnd();
    }
  }

  /**
   * 重置播放器
   */
  reset() {
    this.pause();
    this.currentTime = 0;
    this.duration = 0;
    this.mediaInfo = null;
    this.videoFrameQueue = [];
    this.parser.reset();
    this.audioPlayer.clear();
    
    // 重置统计
    this.stats = {
      framesDecoded: 0,
      framesDropped: 0,
      audioSamplesDecoded: 0
    };
  }

  /**
   * 销毁播放器
   */
  destroy() {
    this.reset();
    
    if (this.renderer) {
      this.renderer.destroy();
    }
    
    if (this.audioPlayer) {
      this.audioPlayer.destroy();
    }
    
    if (this.decoder) {
      this.decoder.destroy();
    }
    
    this.parser.destroy();
  }

  /**
   * 更新加载进度
   */
  updateLoadingProgress(loaded, total) {
    if (this.onLoadStart) {
      this.onLoadStart();
    }
    if (this.onLoadEnd) {
      this.onLoadEnd();
    }
  }

  /**
   * 播放控制
   */
  async play() {
    if (!this.mediaInfo) {
      console.warn('No media loaded');
      return;
    }
    
    // 检查缓冲区状态
    if (this.isStreaming && !this.fastStartEnabled) {
      console.log('Waiting for fast start...');
      if (this.onBufferingStart) {
        this.onBufferingStart();
      }
      return;
    }
    
    this.isPlaying = true;
    this.startTime = performance.now() - this.pausedTime;
    
    // 启动音频播放
    this.audioPlayer.workletNode?.port.postMessage({ type: 'play' });
    
    // 启动视频渲染循环
    this.startRenderLoop();
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }
    
    console.log('Playback started');
  }

  /**
   * 暂停播放
   */
  pause() {
    this.isPlaying = false;
    this.pausedTime = performance.now() - this.startTime;
    
    // 停止音频播放
    this.audioPlayer.workletNode?.port.postMessage({ type: 'pause' });
    
    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
    
    console.log('Playback paused');
  }

  /**
   * 停止播放
   */
  stop() {
    this.pause();
    this.currentTime = 0;
    this.pausedTime = 0;
    this.videoFrameQueue = [];
    this.audioFrameQueue = [];
    
    // 清除音频缓冲
    this.audioPlayer.workletNode?.port.postMessage({ type: 'clear' });
  }

  /**
   * 跳转到指定时间
   */
  async seek(time) {
    const targetTime = Math.max(0, Math.min(time, this.duration));
    this.currentTime = targetTime;
    
    // 清除缓冲队列
    this.videoFrameQueue = [];
    this.audioFrameQueue = [];
    
    // 通知音频处理器
    this.audioPlayer.workletNode?.port.postMessage({
      type: 'seek',
      time: targetTime
    });
    
    // 如果是流式播放，可能需要重新缓冲
    if (this.isStreaming) {
      // 检查是否需要重新开始缓冲
      if (this.onBufferingStart) {
        this.onBufferingStart();
      }
    }
    
    console.log(`Seeked to ${targetTime.toFixed(2)}s`);
  }

  /**
   * 设置音量 (0.0 - 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    this.audioPlayer.workletNode?.port.postMessage({
      type: 'volume',
      volume: this.volume
    });
  }

  /**
   * 设置播放速度 (0.1 - 4.0)
   */
  setPlaybackRate(rate) {
    this.playbackRate = Math.max(0.1, Math.min(4, rate));
    
    this.audioPlayer.workletNode?.port.postMessage({
      type: 'playback-rate',
      rate: this.playbackRate
    });
    
    console.log(`Playback rate set to ${this.playbackRate}x`);
  }

  /**
   * 启用/禁用环绕声
   */
  setSurroundSound(enabled) {
    this.surroundSound = enabled;
    
    this.audioPlayer.workletNode?.port.postMessage({
      type: 'surround-mode',
      enabled: this.surroundSound
    });
    
    console.log(`Surround sound ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * 启动渲染循环
   */
  startRenderLoop() {
    const renderFrame = () => {
      if (!this.isPlaying) return;
      
      this.renderVideoFrame();
      this.updateCurrentTime();
      
      // 继续下一帧
      requestAnimationFrame(renderFrame);
    };
    
    requestAnimationFrame(renderFrame);
  }

  /**
   * 渲染视频帧
   */
  renderVideoFrame() {
    if (this.videoFrameQueue.length === 0) return;
    
    const currentPlayTime = this.getCurrentPlayTime();
    
    // 查找最接近当前时间的帧
    let frameIndex = -1;
    for (let i = 0; i < this.videoFrameQueue.length; i++) {
      const frame = this.videoFrameQueue[i];
      if (frame.timestamp <= currentPlayTime) {
        frameIndex = i;
      } else {
        break;
      }
    }
    
    if (frameIndex >= 0) {
      const frame = this.videoFrameQueue[frameIndex];
      
      // 渲染帧
      if (this.renderer && frame.imageData) {
        this.renderer.renderFrame(frame);
      }
      
      // 移除已渲染的帧
      this.videoFrameQueue.splice(0, frameIndex + 1);
      this.lastVideoTime = frame.timestamp;
    }
  }

  /**
   * 获取当前播放时间
   */
  getCurrentPlayTime() {
    if (!this.isPlaying) {
      return this.currentTime;
    }
    
    const elapsed = (performance.now() - this.startTime) / 1000;
    return this.currentTime + elapsed * this.playbackRate;
  }

  /**
   * 更新当前时间
   */
  updateCurrentTime() {
    const newTime = this.getCurrentPlayTime();
    
    if (Math.abs(newTime - this.currentTime) > 0.1) {
      this.currentTime = newTime;
      
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.currentTime);
      }
    }
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceStats();
    }, 1000);
  }

  /**
   * 更新性能统计
   */
  updatePerformanceStats() {
    // 计算缓冲区健康度
    const videoBufferSeconds = this.videoFrameQueue.length / 30; // 假设30fps
    const audioBufferSeconds = this.audioFrameQueue.length / 50; // 假设50帧/秒音频
    this.stats.bufferHealth = Math.min(videoBufferSeconds, audioBufferSeconds);
    
    // 计算渲染帧率
    if (this.renderer && this.renderer.getStats) {
      const renderStats = this.renderer.getStats();
      this.stats.renderFps = renderStats.fps || 0;
    }
  }

  /**
   * 获取播放器状态
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      currentTime: this.currentTime,
      duration: this.duration,
      volume: this.volume,
      playbackRate: this.playbackRate,
      isLoading: this.isLoading,
      isStreaming: this.isStreaming,
      fastStartEnabled: this.fastStartEnabled,
      audioChannels: this.audioChannels,
      channelLayout: this.channelLayout,
      surroundSound: this.surroundSound,
      stats: this.stats
    };
  }

  /**
   * 获取支持的格式
   */
  async getSupportedFormats() {
    const support = {
      video: {},
      audio: {}
    };
    
    if (this.decoder && this.decoder.checkSupport) {
      // 检查常见视频编解码器
      const videoCodecs = ['avc1.42E01E', 'hev1.1.6.L93.B0', 'vp09.00.10.08', 'av01.0.05M.08'];
      for (const codec of videoCodecs) {
        const result = await this.decoder.checkSupport(codec, null);
        support.video[codec] = {
          supported: result.video,
          hardwareAccelerated: result.videoHardware
        };
      }
      
      // 检查常见音频编解码器
      const audioCodecs = ['mp4a.40.2', 'opus', 'vorbis'];
      for (const codec of audioCodecs) {
        const result = await this.decoder.checkSupport(null, codec);
        support.audio[codec] = {
          supported: result.audio,
          hardwareAccelerated: result.audioHardware
        };
      }
    }
    
    return support;
  }
}