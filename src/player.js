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
      console.log('🔧 [Player] Starting decoder initialization...');
      try {
        await this.initDecoder();
        console.log('📊 [Player] Decoder initialization result:', {
          hasDecoder: !!this.decoder,
          decoderType: this.decoder?.constructor?.name,
          decoderMethods: this.decoder ? Object.getOwnPropertyNames(Object.getPrototypeOf(this.decoder)) : []
        });
      } catch (decoderError) {
        console.error('❌ [Player] Decoder initialization failed during initialize():', decoderError);
        // 继续初始化其他组件，但标记解码器不可用
        this.decoder = null;
      }
      
      // 设置解析器回调
      this.setupParserCallbacks();
      
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
    console.log('🎨 [Player] Initializing renderer...');
    
    try {
      // 尝试使用WebGPU
      console.log('🚀 [Player] Attempting WebGPU initialization...');
      this.renderer = new WebGPURenderer(this.canvas);
      await this.renderer.init();
      console.log('✅ [Player] Using WebGPU renderer');
    } catch (error) {
      console.warn('⚠️ [Player] WebGPU failed, falling back to WebGL:', error);
      
      // 清理失败的WebGPU实例
      if (this.renderer) {
        try {
          this.renderer.destroy();
        } catch (e) {
          console.warn('Failed to cleanup WebGPU renderer:', e);
        }
        this.renderer = null;
      }
      
      try {
        // 后备到WebGL
        console.log('🔄 [Player] Initializing WebGL renderer...');
        this.renderer = new WebGLRenderer(this.canvas);
        await this.renderer.init();
        console.log('✅ [Player] Using WebGL renderer');
      } catch (webglError) {
        console.error('❌ [Player] Both WebGPU and WebGL failed:', webglError);
        throw new Error('No supported renderer available');
      }
    }
  }

  /**
   * 初始化解码器
   */
  async initDecoder() {
    console.log('🎯 [Player] initDecoder started');
    let webcodecsError = null;
    let ffmpegError = null;
    
    try {
      // 尝试使用WebCodecs
      console.log('📱 [Player] Attempting WebCodecs decoder...');
      this.decoder = new WebCodecsDecoder();
      console.log('✅ [Player] WebCodecs decoder instance created');
      
      // WebCodecs解码器不需要async初始化，但需要检查支持
      console.log('🔍 [Player] Checking WebCodecs support:', {
        isVideoSupported: this.decoder.isVideoSupported,
        isAudioSupported: this.decoder.isAudioSupported
      });
      
      if (!this.decoder.isVideoSupported && !this.decoder.isAudioSupported) {
        throw new Error('WebCodecs not supported for video or audio');
      }
      
      console.log('✅ [Player] Using WebCodecs decoder');
    } catch (error) {
      webcodecsError = error;
      console.warn('⚠️ [Player] WebCodecs failed, falling back to FFmpeg:', error);
      
      try {
        // 后备到FFmpeg.wasm
        console.log('🔄 [Player] Attempting FFmpeg decoder...');
        this.decoder = new FFmpegDecoder();
        console.log('⚙️ [Player] FFmpeg decoder instance created, initializing...');
        await this.decoder.init();
        console.log('✅ [Player] Using FFmpeg decoder');
              } catch (ffmpegError) {
          console.error('❌ [Player] Both WebCodecs and FFmpeg failed:', ffmpegError);
          
          // 确保decoder被重置
          this.decoder = null;
          
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
   * 确保解析器回调正确设置
   */
  ensureParserCallbacks() {
    console.log('🔍 [Player] Checking parser callback status...');
    console.log('Current callbacks:', {
      onReady: typeof this.parser.onReady,
      onSamples: typeof this.parser.onSamples,
      onError: typeof this.parser.onError
    });
    
    // 如果回调丢失，重新设置
    if (typeof this.parser.onReady !== 'function') {
      console.log('⚠️ [Player] onReady callback missing, re-setting...');
      this.setupParserCallbacks();
    }
  }

  /**
   * 设置解析器回调 - 增强版
   */
  setupParserCallbacks() {
    // 首先初始化解析器
    this.parser.init();
    
    console.log('🔗 [Player] Setting up parser callbacks...');
    
    this.parser.onReady = (info) => {
      console.log('📢 [Player] Parser onReady callback triggered!', info);
      this.handleMediaReady(info);
    };
    
    console.log('🔍 [Player] Callback assignment verification:', {
      onReadyAssigned: typeof this.parser.onReady === 'function',
      onSamplesAssigned: typeof this.parser.onSamples === 'function',
      onErrorAssigned: typeof this.parser.onError === 'function'
    });
    
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
  async handleMediaReady(info) {
    console.log('🎯 [Player] ===== handleMediaReady TRIGGERED! =====');
    console.log('🎯 [Player] handleMediaReady called with info:', info);
    
    if (!info) {
      console.error('❌ [Player] No media info received!');
      return;
    }
    
    if (!info.tracks || info.tracks.length === 0) {
      console.error('❌ [Player] No tracks found in media info!');
      return;
    }
    
    this.mediaInfo = info;
    this.duration = info.duration / info.timescale;
    this.isStreaming = info.isStreaming || false;
    
    console.log('📊 [Player] Processed media info:', {
      duration: this.duration,
      isStreaming: this.isStreaming,
      hasVideo: info.hasVideo,
      hasAudio: info.hasAudio,
      tracksCount: info.tracks.length,
      timescale: info.timescale,
      rawDuration: info.duration
    });
    
    // 验证tracks
    const videoTracks = info.tracks.filter(t => t.type === 'video');
    const audioTracks = info.tracks.filter(t => t.type === 'audio');
    
    console.log('🎥 [Player] Track analysis:', {
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      allTracks: info.tracks.map(t => ({ id: t.id, type: t.type, codec: t.codec }))
    });
    
    // 设置音频信息
    if (info.hasAudio && this.parser.audioTrack) {
      const audioTrack = this.parser.audioTrack;
      this.audioChannels = audioTrack.audio?.channel_count || 2;
      console.log('🔊 [Player] Setting up audio channels:', this.audioChannels);
      this.setupAudioChannels();
    }
    
    // 开始解码器初始化
    console.log('⚙️ [Player] Initializing decoders with media info...');
    try {
      await this.initDecodersWithMediaInfo();
      console.log('✅ [Player] Decoder initialization completed successfully');
    } catch (error) {
      console.error('❌ [Player] Decoder initialization failed:', error);
    }
    
    if (this.onDurationChange) {
      console.log('⏱️ [Player] Calling onDurationChange callback:', this.duration);
      this.onDurationChange(this.duration);
    }
    
    // 延迟检查解码器状态
    setTimeout(() => {
      console.log('🔍 [Player] Final decoder status check:', {
        hasDecoder: !!this.decoder,
        decoderType: this.decoder?.constructor?.name,
        decoderState: this.decoder ? 'initialized' : 'null'
      });
    }, 100);
    
    console.log('✅ [Player] Media ready - final state:', {
      duration: this.duration,
      hasVideo: info.hasVideo,
      hasAudio: info.hasAudio,
      isStreaming: this.isStreaming,
      audioChannels: this.audioChannels,
      hasDecoder: !!this.decoder,
      hasRenderer: !!this.renderer,
      hasAudioPlayer: !!this.audioPlayer
    });

    // 触发媒体就绪回调
    if (this.onMediaReady) {
      console.log('📢 [Player] Calling onMediaReady callback...');
      this.onMediaReady();
    } else {
      console.warn('⚠️ [Player] No onMediaReady callback set!');
    }
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
    console.log('🔧 [Player] initDecodersWithMediaInfo started');
    console.log('📊 [Player] MediaInfo check:', {
      hasMediaInfo: !!this.mediaInfo,
      hasDecoder: !!this.decoder,
      mediaInfo: this.mediaInfo
    });
    
    if (!this.mediaInfo) {
      console.error('❌ [Player] No media info available for decoder initialization');
      return;
    }
    
    if (!this.decoder) {
      console.error('❌ [Player] No decoder available for initialization');
      console.log('🔄 [Player] Attempting to re-initialize decoder...');
      try {
        await this.initDecoder();
        if (!this.decoder) {
          console.error('❌ [Player] Decoder re-initialization failed');
          return;
        }
        console.log('✅ [Player] Decoder re-initialization successful');
      } catch (error) {
        console.error('❌ [Player] Decoder re-initialization error:', error);
        return;
      }
    }
    
    try {
      // 初始化视频解码器
      if (this.mediaInfo.hasVideo && this.parser.videoTrack) {
        console.log('🎥 [Player] Initializing video decoder...');
        console.log('🎬 [Player] Video track info:', this.parser.videoTrack);
        
        const videoConfig = this.createVideoConfig();
        console.log('⚙️ [Player] Video config:', videoConfig);
        
        await this.decoder.initVideoDecoder(videoConfig);
        console.log('✅ [Player] Video decoder initialized successfully');
      } else {
        console.log('⚠️ [Player] Skipping video decoder - hasVideo:', this.mediaInfo.hasVideo, 'videoTrack:', !!this.parser.videoTrack);
      }
      
      // 初始化音频解码器  
      if (this.mediaInfo.hasAudio && this.parser.audioTrack) {
        console.log('🔊 [Player] Initializing audio decoder...');
        console.log('🎵 [Player] Audio track info:', this.parser.audioTrack);
        
        const audioConfig = this.createAudioConfig();
        console.log('⚙️ [Player] Audio config:', audioConfig);
        
        await this.decoder.initAudioDecoder(audioConfig);
        console.log('✅ [Player] Audio decoder initialized successfully');
      } else {
        console.log('⚠️ [Player] Skipping audio decoder - hasAudio:', this.mediaInfo.hasAudio, 'audioTrack:', !!this.parser.audioTrack);
      }
      
      console.log('✅ [Player] All decoders initialized with media info');
      
    } catch (error) {
      console.error('❌ [Player] Failed to initialize decoders with media info:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      if (this.onError) {
        this.onError(error);
      }
      throw error; // 重新抛出以便上层处理
    }
  }

  /**
   * 创建视频配置
   */
  createVideoConfig() {
    const track = this.parser.videoTrack;
    
    console.log('🔍 [Player] Creating video config for track:', track);
    console.log('🔍 [Player] Available decoder config fields:', {
      avcDecoderConfigRecord: !!track.avcDecoderConfigRecord,
      hvcDecoderConfigRecord: !!track.hvcDecoderConfigRecord,
      avcC: !!track.avcC,
      hvcC: !!track.hvcC,
      mp4track: !!track.mp4track
    });
    
    // 尝试多种可能的decoder config record字段名
    let description = track.avcDecoderConfigRecord || 
                     track.hvcDecoderConfigRecord || 
                     track.avcC || 
                     track.hvcC ||
                     track.mp4track?.avcDecoderConfigRecord ||
                     track.mp4track?.hvcDecoderConfigRecord;
    
    // 如果还是没有description，但是是H.264，尝试从其他地方获取
    if (!description && (track.codec.includes('avc1') || track.codec.includes('h264'))) {
      console.warn('⚠️ [Player] No AVC decoder config record found, attempting to extract from track');
      // 可以尝试从track的其他属性中提取
      if (track.mimeCodec) {
        console.log('🔍 [Player] Track mimeCodec:', track.mimeCodec);
      }
    }
    
    const config = {
      codec: track.codec,
      codedWidth: track.video.width,
      codedHeight: track.video.height,
      hardwareAcceleration: 'prefer-hardware',
      optimizeForLatency: true
    };
    
    // 只有在有description的情况下才添加
    if (description) {
      config.description = description;
      console.log('✅ [Player] Added description to video config, size:', description.byteLength || description.length);
    } else {
      console.warn('⚠️ [Player] No description available for video config');
    }
    
    return config;
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
    console.log('🎬 [Player] loadFile() called with:', file);
    
    this.reset();
    this.setLoading(true);
    
    try {
      if (file instanceof File) {
        console.log('📁 [Player] Loading local file...');
        await this.loadLocalFile(file);
      } else if (typeof file === 'string') {
        console.log('🌐 [Player] Loading URL...');
        await this.loadFromURL(file);
      } else {
        throw new Error('Unsupported file type');
      }
      
      console.log('✅ [Player] File load process completed');
      
    } catch (error) {
      console.error('❌ [Player] Failed to load file:', error);
      this.setLoading(false);
      if (this.onError) {
        this.onError(error);
      }
      throw error; // 重新抛出错误以便上层处理
    }
  }

  /**
   * 加载本地文件
   */
  async loadLocalFile(file) {
    console.log('📁 [Player] loadLocalFile started');
    
    try {
      console.log('📖 [Player] Reading file as ArrayBuffer...');
      const arrayBuffer = await file.arrayBuffer();
      
      console.log(`📊 [Player] File read complete: ${arrayBuffer.byteLength} bytes`);
      
      // 确保回调在发送数据前设置正确
      console.log('🔗 [Player] Ensuring parser callbacks before data send...');
      this.ensureParserCallbacks();
      
      console.log('📦 [Player] Sending to parser...');
      await this.parser.appendBuffer(arrayBuffer);
      
      console.log('✅ [Player] Local file processing initiated');
      // 注意：不需要调用 this.parser.start()，appendBuffer内部已经处理
      
    } catch (error) {
      console.error('❌ [Player] Failed to load local file:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
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
        await this.parser.appendBuffer(value.buffer);
        
        // 如果还没开始，尝试开始解析
        if (!this.parser.isInitialized && this.parser.info) {
          this.parser.start();
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // 删除重复的handleMediaReady方法 - 使用增强版本

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
    console.log('🎬 [Player] handleVideoFrame called:', {
      hasFrame: !!frame,
      width: frame?.width,
      height: frame?.height,
      timestamp: frame?.timestamp,
      hasImageData: !!(frame?.imageData)
    });
    
    if (!frame || !frame.imageData || !frame.width || !frame.height) {
      console.warn('⚠️ [Player] Invalid video frame received');
      return;
    }
    
    this.stats.framesDecoded++;
    
    try {
      // 直接渲染帧，不使用复杂的队列系统
      if (this.renderer) {
        console.log('🖼️ [Player] Rendering frame directly to renderer');
        this.renderer.renderFrame(frame.imageData.data, frame.width, frame.height);
      } else {
        console.warn('⚠️ [Player] No renderer available, using fallback Canvas 2D');
        this.fallbackRender(frame);
      }
      
    } catch (error) {
      console.error('❌ [Player] Error handling video frame:', error);
    }
  }

  /**
   * 处理音频帧
   */
  handleAudioFrame(frame) {
    console.log('🔊 [Player] handleAudioFrame called:', {
      hasFrame: !!frame,
      dataLength: frame?.data?.length,
      channelCount: frame?.channelCount,
      sampleRate: frame?.sampleRate,
      timestamp: frame?.timestamp
    });
    
    if (!frame || !frame.data || !frame.channelCount) {
      console.warn('⚠️ [Player] Invalid audio frame received');
      return;
    }
    
    this.stats.audioSamplesDecoded += frame.data.length;
    
    try {
      // 直接发送到音频播放器，不使用SharedArrayBuffer
      if (this.audioPlayer) {
        console.log('🎵 [Player] Sending audio data to player');
        this.audioPlayer.addAudioData(frame.data.buffer, frame.timestamp);
      } else {
        console.warn('⚠️ [Player] No audio player available for frame');
      }
      
    } catch (error) {
      console.error('❌ [Player] Error handling audio frame:', error);
    }
  }

  // renderCurrentFrame method removed - now rendering directly in handleVideoFrame

  /**
   * 降级Canvas 2D渲染
   */
  fallbackRender(frame) {
    try {
      console.log('🎨 [Player] Using Canvas 2D fallback rendering');
      
      // 设置画布尺寸
      if (this.canvas.width !== frame.width || this.canvas.height !== frame.height) {
        this.canvas.width = frame.width;
        this.canvas.height = frame.height;
        console.log(`📐 [Player] Canvas resized to ${frame.width}x${frame.height}`);
      }
      
      const ctx = this.canvas.getContext('2d');
      if (ctx && frame.imageData) {
        ctx.putImageData(frame.imageData, 0, 0);
        console.log('✅ [Player] Frame rendered with Canvas 2D');
      } else {
        console.error('❌ [Player] Failed to get 2D context or imageData');
      }
      
    } catch (error) {
      console.error('❌ [Player] Canvas 2D fallback failed:', error);
    }
  }

  /**
   * 播放
   */
  async play() {
    console.log('▶️ [Player] play() called');
    console.log('🎬 [Player] Current state check:', {
      hasMediaInfo: !!this.mediaInfo,
      hasDecoder: !!this.decoder,
      hasRenderer: !!this.renderer,
      hasAudioPlayer: !!this.audioPlayer,
      duration: this.duration,
      currentTime: this.currentTime
    });
    
    if (!this.mediaInfo) {
      console.warn('⚠️ [Player] No media loaded - cannot play');
      return;
    }
    
    if (!this.decoder) {
      console.error('❌ [Player] No decoder available - cannot play');
      return;
    }
    
    if (!this.renderer) {
      console.error('❌ [Player] No renderer available - cannot play');
      return;
    }

    console.log('✅ [Player] All components ready, starting playback...');
    this.isPlaying = true;
    
    try {
      await this.audioPlayer.play();
      console.log('🔊 [Player] Audio player started successfully');
    } catch (error) {
      console.error('❌ [Player] Failed to start audio player:', error);
    }
    
    // 开始样本提取和解码循环
    this.startPlaybackLoop();
    
    if (this.onPlayStateChange) {
      console.log('📢 [Player] Calling onPlayStateChange(true)');
      this.onPlayStateChange(true);
    } else {
      console.warn('⚠️ [Player] No onPlayStateChange callback set');
    }
    
    console.log('✅ [Player] Play initiated successfully');
  }

  /**
   * 开始播放循环
   */
  startPlaybackLoop() {
    console.log('🔄 [Player] Starting playback loop...');
    
    if (!this.isPlaying) {
      console.log('⏸️ [Player] Not playing, stopping loop');
      return;
    }
    
    // 请求样本数据进行解码
    if (this.parser && this.parser.mp4boxfile) {
      try {
        // 启动MP4Box样本提取
        if (this.parser.videoTrack) {
          console.log('🎬 [Player] Starting video sample extraction...');
          this.parser.mp4boxfile.setExtractionOptions(this.parser.videoTrack.id, null, {
            nbSamples: 10 // 批量提取样本
          });
        }
        
        if (this.parser.audioTrack) {
          console.log('🔊 [Player] Starting audio sample extraction...');
          this.parser.mp4boxfile.setExtractionOptions(this.parser.audioTrack.id, null, {
            nbSamples: 10 // 批量提取样本
          });
        }
        
        // 启动处理
        this.parser.mp4boxfile.start();
        console.log('✅ [Player] Sample extraction started');
        
      } catch (error) {
        console.error('❌ [Player] Failed to start sample extraction:', error);
      }
    } else {
      console.error('❌ [Player] Parser or MP4Box not available for playback');
    }
  }

  /**
   * 暂停
   */
  pause() {
    console.log('⏸️ [Player] pause() called');
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
   * 获取当前时间 - getCurrentPlayTime的别名
   */
  getCurrentTime() {
    return this.getCurrentPlayTime();
  }
}