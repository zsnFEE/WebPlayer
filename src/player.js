import { WebGPURenderer } from './render/webgpu-renderer.js';
import { WebGLRenderer } from './render/webgl-renderer.js';
import { AudioPlayer } from './audio/audio-player.js';
import { WebCodecsDecoder } from './decoder/webcodecs-decoder.js';
import { FFmpegDecoder } from './decoder/ffmpeg-decoder.js';
import { MP4Parser } from './parser/mp4-parser.js';
import { sharedBufferManager } from './utils/shared-buffer.js';

/**
 * 主播放器类
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
    
    // 缓冲和流控制
    this.isLoading = false;
    this.videoFrameQueue = [];
    this.audioFrameQueue = [];
    this.lastVideoTime = 0;
    this.lastAudioTime = 0;
    
    // 事件回调
    this.onTimeUpdate = null;
    this.onDurationChange = null;
    this.onLoadStart = null;
    this.onLoadEnd = null;
    this.onError = null;
    this.onPlayStateChange = null;
    
    // 性能监控
    this.stats = {
      framesDecoded: 0,
      framesDropped: 0,
      audioSamplesDecoded: 0
    };
    
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
      this.setupParserCallbacks();
      
      // 设置音频播放器回调
      this.setupAudioCallbacks();
      
      console.log('WebAV Player initialized');
      
    } catch (error) {
      console.error('Failed to initialize player:', error);
      if (this.onError) {
        this.onError(error);
      }
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
    try {
      // 尝试使用WebCodecs
      this.decoder = new WebCodecsDecoder();
      console.log('Using WebCodecs decoder');
    } catch (error) {
      console.warn('WebCodecs failed, falling back to FFmpeg:', error);
      
      try {
        // 后备到FFmpeg.wasm
        this.decoder = new FFmpegDecoder();
        await this.decoder.init();
        console.log('Using FFmpeg decoder');
      } catch (ffmpegError) {
        console.error('Both WebCodecs and FFmpeg failed:', ffmpegError);
        throw new Error('No supported decoder available');
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
   * 设置解析器回调
   */
  setupParserCallbacks() {
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
  }

  /**
   * 设置音频播放器回调
   */
  setupAudioCallbacks() {
    this.audioPlayer.onTimeUpdate = (time) => {
      this.currentTime = time;
      if (this.onTimeUpdate) {
        this.onTimeUpdate(time);
      }
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
}