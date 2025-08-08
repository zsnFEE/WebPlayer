/**
 * WebCodecs 解码器 - 支持H264/H265硬件加速解码
 */
export class WebCodecsDecoder {
  constructor() {
    this.videoDecoder = null;
    this.audioDecoder = null;
    this.isVideoSupported = this.checkVideoCodecsSupport();
    this.isAudioSupported = this.checkAudioCodecsSupport();
    this.videoQueue = [];
    this.audioQueue = [];
    this.onVideoFrame = null;
    this.onAudioFrame = null;
    
    // 编解码器支持缓存
    this.codecSupport = new Map();
    this.hardwareAcceleration = true;
    
    // 性能监控
    this.stats = {
      decodedFrames: 0,
      droppedFrames: 0,
      hardwareDecoded: 0,
      softwareDecoded: 0
    };
    
    // 关键帧和description跟踪
    this.hasDescription = false;
    this.receivedFirstKeyframe = false;
  }

  /**
   * 检查 WebCodecs 支持
   */
  checkVideoCodecsSupport() {
    try {
      return typeof VideoDecoder !== 'undefined' && 'VideoDecoder' in window;
    } catch (error) {
      return false;
    }
  }

  checkAudioCodecsSupport() {
    try {
      return typeof AudioDecoder !== 'undefined' && 'AudioDecoder' in window;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查编解码器支持 - 增强版
   */
  async checkSupport(videoCodec, audioCodec) {
    const support = {
      video: false,
      audio: false,
      videoHardware: false,
      audioHardware: false
    };

    if (this.isVideoSupported && videoCodec) {
      support.video = await this.checkVideoCodecSupport(videoCodec);
      support.videoHardware = await this.checkHardwareAcceleration(videoCodec);
    }

    if (this.isAudioSupported && audioCodec) {
      support.audio = await this.checkAudioCodecSupport(audioCodec);
      support.audioHardware = await this.checkAudioHardwareAcceleration(audioCodec);
    }

    return support;
  }

  /**
   * 检查视频编解码器支持
   */
  async checkVideoCodecSupport(codec) {
    // 检查缓存
    if (this.codecSupport.has(codec)) {
      return this.codecSupport.get(codec);
    }

    try {
      // 测试多种配置
      const testConfigs = this.generateVideoTestConfigs(codec);
      
      for (const config of testConfigs) {
        try {
          const result = await VideoDecoder.isConfigSupported(config);
          if (result.supported) {
            this.codecSupport.set(codec, true);
            console.log(`Video codec ${codec} supported with config:`, config);
            return true;
          }
        } catch (error) {
          console.debug(`Video codec ${codec} test failed:`, error);
        }
      }
      
      this.codecSupport.set(codec, false);
      return false;
      
    } catch (error) {
      console.warn('Video codec support check failed:', codec, error);
      this.codecSupport.set(codec, false);
      return false;
    }
  }

  /**
   * 生成视频测试配置
   */
  generateVideoTestConfigs(codec) {
    const baseConfigs = [];
    
    if (codec.includes('avc1') || codec.includes('h264')) {
      // H.264 配置
      baseConfigs.push(
        { codec: 'avc1.42E01E', codedWidth: 1920, codedHeight: 1080 }, // Baseline
        { codec: 'avc1.4D4028', codedWidth: 1920, codedHeight: 1080 }, // Main
        { codec: 'avc1.64001F', codedWidth: 1920, codedHeight: 1080 }, // High
        { codec: 'avc1.640028', codedWidth: 1920, codedHeight: 1080 }  // High
      );
    }
    
    if (codec.includes('hev1') || codec.includes('hvc1') || codec.includes('h265')) {
      // H.265/HEVC 配置
      baseConfigs.push(
        { codec: 'hev1.1.6.L93.B0', codedWidth: 1920, codedHeight: 1080 }, // Main
        { codec: 'hvc1.1.6.L93.B0', codedWidth: 1920, codedHeight: 1080 }, // Main
        { codec: 'hev1.2.4.L93.B0', codedWidth: 1920, codedHeight: 1080 }, // Main10
        { codec: 'hvc1.2.4.L93.B0', codedWidth: 1920, codedHeight: 1080 }  // Main10
      );
    }
    
    if (codec.includes('vp9')) {
      // VP9 配置
      baseConfigs.push(
        { codec: 'vp09.00.10.08', codedWidth: 1920, codedHeight: 1080 },
        { codec: 'vp09.01.20.08.01', codedWidth: 1920, codedHeight: 1080 }
      );
    }
    
    if (codec.includes('av01')) {
      // AV1 配置
      baseConfigs.push(
        { codec: 'av01.0.05M.08', codedWidth: 1920, codedHeight: 1080 }
      );
    }
    
    // 如果没有匹配的配置，使用原始codec字符串
    if (baseConfigs.length === 0) {
      baseConfigs.push({ codec, codedWidth: 1920, codedHeight: 1080 });
    }
    
    return baseConfigs;
  }

  /**
   * 检查硬件加速支持
   */
  async checkHardwareAcceleration(codec) {
    try {
      const configs = this.generateVideoTestConfigs(codec);
      
      for (const config of configs) {
        const configWithHardware = {
          ...config,
          hardwareAcceleration: 'prefer-hardware'
        };
        
        try {
          const result = await VideoDecoder.isConfigSupported(configWithHardware);
          if (result.supported) {
            console.log(`Hardware acceleration available for ${codec}`);
            return true;
          }
        } catch (error) {
          // 继续尝试下一个配置
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查音频编解码器支持
   */
  async checkAudioCodecSupport(codec) {
    try {
      const testConfigs = this.generateAudioTestConfigs(codec);
      
      for (const config of testConfigs) {
        try {
          const result = await AudioDecoder.isConfigSupported(config);
          if (result.supported) {
            console.log(`Audio codec ${codec} supported`);
            return true;
          }
        } catch (error) {
          console.debug(`Audio codec ${codec} test failed:`, error);
        }
      }
      
      return false;
    } catch (error) {
      console.warn('Audio codec support check failed:', codec, error);
      return false;
    }
  }

  /**
   * 生成音频测试配置
   */
  generateAudioTestConfigs(codec) {
    const configs = [];
    
    if (codec.includes('mp4a') || codec.includes('aac')) {
      configs.push(
        { codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2 }, // AAC-LC
        { codec: 'mp4a.40.5', sampleRate: 44100, numberOfChannels: 2 }, // HE-AAC
        { codec: 'mp4a.40.29', sampleRate: 44100, numberOfChannels: 2 } // HE-AACv2
      );
    }
    
    if (codec.includes('opus')) {
      configs.push(
        { codec: 'opus', sampleRate: 48000, numberOfChannels: 2 }
      );
    }
    
    if (codec.includes('vorbis')) {
      configs.push(
        { codec: 'vorbis', sampleRate: 44100, numberOfChannels: 2 }
      );
    }
    
    // 默认配置
    if (configs.length === 0) {
      configs.push({
        codec,
        sampleRate: 44100,
        numberOfChannels: 2
      });
    }
    
    return configs;
  }

  /**
   * 检查音频硬件加速
   */
  async checkAudioHardwareAcceleration(codec) {
    // 音频硬件加速支持相对较少，主要在移动设备上
    try {
      const config = {
        codec,
        sampleRate: 44100,
        numberOfChannels: 2,
        hardwareAcceleration: 'prefer-hardware'
      };
      
      const result = await AudioDecoder.isConfigSupported(config);
      return result.supported;
    } catch (error) {
      return false;
    }
  }

  /**
   * 初始化视频解码器 - 增强版
   */
  async initVideoDecoder(config) {
    console.log('🎥 [WebCodecs] initVideoDecoder called with config:', config);
    console.log('🔍 [WebCodecs] Support check:', {
      isVideoSupported: this.isVideoSupported,
      hasVideoDecoder: typeof VideoDecoder !== 'undefined',
      windowVideoDecoder: 'VideoDecoder' in window
    });
    
    if (!this.isVideoSupported) {
      console.error('❌ [WebCodecs] VideoDecoder not supported');
      throw new Error('VideoDecoder not supported');
    }

    // 优化配置以支持硬件加速
    console.log('⚙️ [WebCodecs] Optimizing video config...');
    const optimizedConfig = await this.optimizeVideoConfig(config);
    console.log('✅ [WebCodecs] Optimized config:', optimizedConfig);

    console.log('🔧 [WebCodecs] Creating VideoDecoder instance...');
    this.videoDecoder = new VideoDecoder({
      output: (frame) => {
        console.log('🎬 [WebCodecs] Video frame decoded:', {
          timestamp: frame.timestamp,
          duration: frame.duration,
          format: frame.format
        });
        this.handleVideoFrame(frame);
        this.stats.decodedFrames++;
        
        // 检测是否使用硬件加速
        if (frame.format && frame.format.includes('nv12')) {
          this.stats.hardwareDecoded++;
        } else {
          this.stats.softwareDecoded++;
        }
      },
      error: (error) => {
        console.error('❌ [WebCodecs] Video decoder error:', error);
        this.stats.droppedFrames++;
      }
    });

    try {
      console.log('🔧 [WebCodecs] Configuring video decoder...');
      this.videoDecoder.configure(optimizedConfig);
      
      // 设置description状态
      this.hasDescription = !!optimizedConfig.description;
      this.receivedFirstKeyframe = false; // 重置关键帧状态
      
      console.log('✅ [WebCodecs] Video decoder initialized with config:', optimizedConfig);
      console.log('🔍 [WebCodecs] Description available:', this.hasDescription);
      
      // 报告硬件加速状态
      if (optimizedConfig.hardwareAcceleration) {
        console.log('Hardware acceleration enabled for video decoder');
      }
      
    } catch (error) {
      console.error('Failed to configure video decoder:', error);
      throw error;
    }
  }

  /**
   * 优化视频配置
   */
  async optimizeVideoConfig(config) {
    const optimized = { ...config };
    
    // 尝试启用硬件加速
    if (this.hardwareAcceleration) {
      optimized.hardwareAcceleration = 'prefer-hardware';
    }
    
    // 设置优化选项
    optimized.optimizeForLatency = true;
    
    // 对于H.264和H.265，添加特定优化
    if (config.codec.includes('avc1') || config.codec.includes('h264')) {
      // H.264 特定优化
      if (config.description) {
        optimized.description = config.description; // 确保包含SPS/PPS
        console.log('✅ [WebCodecs] H.264 description provided, size:', config.description.byteLength || config.description.length);
      } else {
        console.warn('⚠️ [WebCodecs] No description for H.264, decoder may fail on first non-keyframe');
        // 对于没有description的H.264，我们仍然尝试配置，但期望第一帧是关键帧
      }
    }
    
    if (config.codec.includes('hev1') || config.codec.includes('hvc1')) {
      // H.265 特定优化
      if (config.description) {
        optimized.description = config.description; // 确保包含VPS/SPS/PPS
        console.log('✅ [WebCodecs] H.265 description provided, size:', config.description.byteLength || config.description.length);
      } else {
        console.warn('⚠️ [WebCodecs] No description for H.265, decoder may fail');
      }
    }
    
    return optimized;
  }

  /**
   * 初始化音频解码器
   */
  async initAudioDecoder(config) {
    if (!this.isAudioSupported) {
      throw new Error('AudioDecoder not supported');
    }

    this.audioDecoder = new AudioDecoder({
      output: (data) => {
        this.handleAudioData(data);
      },
      error: (error) => {
        console.error('Audio decoder error:', error);
      }
    });

    try {
      this.audioDecoder.configure(config);
      console.log('Audio decoder initialized:', config);
    } catch (error) {
      console.error('Failed to configure audio decoder:', error);
      throw error;
    }
  }

  /**
   * 处理视频帧
   */
  handleVideoFrame(frame) {
    if (this.onVideoFrame) {
      try {
        // 尝试使用 OffscreenCanvas，如果不支持则使用普通 Canvas
        let canvas, ctx;
        
        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
          ctx = canvas.getContext('2d');
        } else {
          // 后备方案：使用文档中的 canvas 元素
          canvas = document.createElement('canvas');
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
          ctx = canvas.getContext('2d');
        }
        
        ctx.drawImage(frame, 0, 0);
        const imageData = ctx.getImageData(0, 0, frame.displayWidth, frame.displayHeight);
        
        this.onVideoFrame({
          imageData: imageData,
          width: frame.displayWidth,
          height: frame.displayHeight,
          timestamp: frame.timestamp
        });
        
        // 清理VideoFrame资源
        frame.close();
      } catch (error) {
        console.error('Error handling video frame:', error);
        frame.close();
      }
    } else {
      frame.close();
    }
  }

  /**
   * 处理音频数据
   */
  handleAudioData(audioData) {
    if (this.onAudioFrame) {
      // 转换AudioData为Float32Array
      const channelCount = audioData.numberOfChannels;
      const sampleCount = audioData.numberOfFrames;
      const totalSamples = channelCount * sampleCount;
      
      const buffer = new Float32Array(totalSamples);
      
      // 复制音频数据
      for (let channel = 0; channel < channelCount; channel++) {
        const channelData = new Float32Array(sampleCount);
        audioData.copyTo(channelData, { planeIndex: channel });
        
        // 交错存储
        for (let i = 0; i < sampleCount; i++) {
          buffer[i * channelCount + channel] = channelData[i];
        }
      }

      this.onAudioFrame({
        data: buffer,
        timestamp: audioData.timestamp / 1000000, // 转换为秒
        sampleRate: audioData.sampleRate,
        channelCount: channelCount
      });
    }
    
    audioData.close();
  }

  /**
   * 解码视频数据
   */
  decodeVideo(encodedData, timestamp, isKeyframe = false) {
    if (!this.videoDecoder || this.videoDecoder.state !== 'configured') {
      console.warn('Video decoder not ready');
      return;
    }

    // 如果没有description且还没有收到关键帧，等待关键帧
    if (!this.hasDescription && !this.receivedFirstKeyframe && !isKeyframe) {
      console.warn('⚠️ [WebCodecs] Waiting for keyframe (no description provided)');
      return;
    }

    try {
      const chunk = new EncodedVideoChunk({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: timestamp * 1000000, // 转换为微秒
        data: encodedData
      });

      console.log(`🎬 [WebCodecs] Decoding ${isKeyframe ? 'KEY' : 'DELTA'} frame at ${timestamp}s`);
      this.videoDecoder.decode(chunk);
      
      // 标记已收到第一个关键帧
      if (isKeyframe && !this.receivedFirstKeyframe) {
        this.receivedFirstKeyframe = true;
        console.log('✅ [WebCodecs] First keyframe received and decoded');
      }
    } catch (error) {
      console.error('❌ [WebCodecs] Video decode error:', error);
      
      // 如果是缺少关键帧的错误，提供更详细的信息
      if (error.message.includes('key frame is required')) {
        console.error('🔑 [WebCodecs] Key frame required! Current frame type:', isKeyframe ? 'KEY' : 'DELTA');
        console.error('🔑 [WebCodecs] Has description:', !!this.hasDescription);
        console.error('🔑 [WebCodecs] Received first keyframe:', !!this.receivedFirstKeyframe);
      }
    }
  }

  /**
   * 解码音频数据
   */
  decodeAudio(encodedData, timestamp) {
    if (!this.audioDecoder || this.audioDecoder.state !== 'configured') {
      console.warn('Audio decoder not ready');
      return;
    }

    try {
      const chunk = new EncodedAudioChunk({
        type: 'key',
        timestamp: timestamp * 1000000, // 转换为微秒
        data: encodedData
      });

      this.audioDecoder.decode(chunk);
    } catch (error) {
      console.error('Audio decode error:', error);
    }
  }

  /**
   * 刷新解码器
   */
  async flush() {
    const promises = [];
    
    if (this.videoDecoder && this.videoDecoder.state === 'configured') {
      promises.push(this.videoDecoder.flush());
    }
    
    if (this.audioDecoder && this.audioDecoder.state === 'configured') {
      promises.push(this.audioDecoder.flush());
    }
    
    await Promise.all(promises);
  }

  /**
   * 重置解码器
   */
  reset() {
    if (this.videoDecoder) {
      this.videoDecoder.reset();
    }
    
    if (this.audioDecoder) {
      this.audioDecoder.reset();
    }
  }

  /**
   * 销毁解码器
   */
  destroy() {
    if (this.videoDecoder) {
      this.videoDecoder.close();
      this.videoDecoder = null;
    }
    
    if (this.audioDecoder) {
      this.audioDecoder.close();
      this.audioDecoder = null;
    }
  }
}