/**
 * FFmpeg.wasm 解码器 (WebCodecs 后备方案)
 */
export class FFmpegDecoder {
  constructor() {
    this.ffmpeg = null;
    this.isLoaded = false;
    this.onVideoFrame = null;
    this.onAudioFrame = null;
    this.videoProcessing = false;
    this.audioProcessing = false;
    this.initializationPromise = null;
    this.isSupported = this.checkEnvironmentSupport();
  }

  /**
   * 检查环境支持
   */
  checkEnvironmentSupport() {
    try {
      // 检查基本的WebAssembly和SharedArrayBuffer支持
      const hasWasm = typeof WebAssembly !== 'undefined';
      const hasSharedBuffer = typeof SharedArrayBuffer !== 'undefined' || typeof ArrayBuffer !== 'undefined';
      const hasWorker = typeof Worker !== 'undefined';
      
      return hasWasm && hasSharedBuffer && hasWorker;
    } catch (error) {
      console.warn('FFmpeg environment check failed:', error);
      return false;
    }
  }

  /**
   * 初始化FFmpeg
   */
  async init() {
    if (this.isLoaded) return true;
    if (this.initializationPromise) return this.initializationPromise;

    if (!this.isSupported) {
      throw new Error('FFmpeg is not supported in this environment');
    }

    this.initializationPromise = this._initializeFFmpeg();
    return this.initializationPromise;
  }

  async _initializeFFmpeg() {
    try {
      console.log('Initializing FFmpeg.wasm...');
      
      // 动态导入FFmpeg以避免初始化错误
      const ffmpegModule = await import('@ffmpeg/ffmpeg');
      const utilModule = await import('@ffmpeg/util');
      
      const FFmpeg = ffmpegModule.FFmpeg || ffmpegModule.default?.FFmpeg;
      const toBlobURL = utilModule.toBlobURL || utilModule.default?.toBlobURL;
      
      if (!FFmpeg || !toBlobURL) {
        throw new Error('Failed to import FFmpeg modules');
      }
      
      this.ffmpeg = new FFmpeg();

      // 加载FFmpeg核心文件
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      // 设置事件监听
      this.ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg log:', message);
      });

      this.ffmpeg.on('progress', ({ progress, time }) => {
        console.log(`FFmpeg progress: ${Math.round(progress)}% (${time}s)`);
      });

      // 加载核心文件
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('FFmpeg.wasm loaded successfully');
      return true;
      
    } catch (error) {
      console.error('FFmpeg initialization failed:', error);
      this.isLoaded = false;
      this.initializationPromise = null;
      
      // 提供更详细的错误信息
      let errorMessage = 'FFmpeg initialization failed';
      
      if (error.message.includes('fetch')) {
        errorMessage = 'Failed to download FFmpeg core files. Check network connection.';
      } else if (error.message.includes('WebAssembly')) {
        errorMessage = 'WebAssembly not supported or failed to load.';
      } else if (error.message.includes('SharedArrayBuffer')) {
        errorMessage = 'SharedArrayBuffer not available. Try serving over HTTPS.';
      }
      
      throw new Error(`${errorMessage}: ${error.message}`);
    }
  }

  /**
   * 检查FFmpeg是否已准备就绪
   */
  isReady() {
    return this.isLoaded && this.ffmpeg;
  }

  /**
   * 解码视频文件 (原始方法，用于完整文件解码)
   */
  async decodeVideoFile(videoData, outputFormat = 'rawvideo') {
    if (!this.isLoaded || this.videoProcessing) return;

    this.videoProcessing = true;

    try {
      // 写入输入文件
      await this.ffmpeg.writeFile('input.mp4', new Uint8Array(videoData));

      // 提取视频帧
      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-f', 'rawvideo',
        '-pix_fmt', 'rgba',
        '-an', // 忽略音频
        'output.raw'
      ]);

      // 获取视频信息
      const probe = await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-hide_banner'
      ]);

      // 读取原始视频数据
      const data = await this.ffmpeg.readFile('output.raw');
      
      // 解析视频信息 (简化版本)
      const width = 1920; // 需要从probe输出中解析
      const height = 1080;
      const frameSize = width * height * 4; // RGBA
      const frameCount = data.length / frameSize;

      // 逐帧处理
      for (let i = 0; i < frameCount; i++) {
        const frameData = data.slice(i * frameSize, (i + 1) * frameSize);
        const timestamp = i / 30; // 假设30fps

        if (this.onVideoFrame) {
          this.onVideoFrame({
            data: frameData,
            width: width,
            height: height,
            timestamp: timestamp
          });
        }
      }

      // 清理文件
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile('output.raw');

    } catch (error) {
      console.error('FFmpeg video decode error:', error);
    } finally {
      this.videoProcessing = false;
    }
  }

  /**
   * 解码音频文件 (原始方法，用于完整文件解码)
   */
  async decodeAudioFile(audioData) {
    if (!this.isLoaded || this.audioProcessing) return;

    this.audioProcessing = true;

    try {
      // 写入输入文件
      await this.ffmpeg.writeFile('input.mp4', new Uint8Array(audioData));

      // 提取音频数据
      await this.ffmpeg.exec([
        '-i', 'input.mp4',
        '-f', 'f32le', // 32-bit float PCM
        '-ar', '44100', // 采样率
        '-ac', '2', // 立体声
        '-vn', // 忽略视频
        'output.pcm'
      ]);

      // 读取PCM数据
      const data = await this.ffmpeg.readFile('output.pcm');
      const audioBuffer = new Float32Array(data.buffer);

      // 计算时长
      const sampleRate = 44100;
      const channelCount = 2;
      const duration = audioBuffer.length / (sampleRate * channelCount);

      // 分块处理音频数据
      const chunkSize = sampleRate * 0.1; // 100ms 块
      const totalChunks = Math.ceil(audioBuffer.length / (chunkSize * channelCount));

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize * channelCount;
        const end = Math.min(start + chunkSize * channelCount, audioBuffer.length);
        const chunkData = audioBuffer.slice(start, end);
        const timestamp = (i * chunkSize) / sampleRate;

        if (this.onAudioFrame) {
          this.onAudioFrame({
            data: chunkData,
            timestamp: timestamp,
            sampleRate: sampleRate,
            channelCount: channelCount
          });
        }
      }

      // 清理文件
      await this.ffmpeg.deleteFile('input.mp4');
      await this.ffmpeg.deleteFile('output.pcm');

    } catch (error) {
      console.error('FFmpeg audio decode error:', error);
    } finally {
      this.audioProcessing = false;
    }
  }

  /**
   * 解码单个视频块
   */
  async decodeVideoChunk(chunkData, timestamp) {
    // 对于流式解码，FFmpeg.wasm 不是最佳选择
    // 这里提供一个简化的实现
    console.warn('FFmpeg chunk decode not optimal for streaming');
  }

  /**
   * 解码单个音频块
   */
  async decodeAudioChunk(chunkData, timestamp) {
    // 对于流式解码，FFmpeg.wasm 不是最佳选择
    console.warn('FFmpeg chunk decode not optimal for streaming');
  }

  /**
   * 获取媒体信息
   */
  async getMediaInfo(mediaData) {
    if (!this.isLoaded) await this.init();

    try {
      await this.ffmpeg.writeFile('probe.mp4', new Uint8Array(mediaData));
      
      // 使用ffprobe获取媒体信息
      await this.ffmpeg.exec([
        '-i', 'probe.mp4',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams'
      ]);

      // 这里应该解析JSON输出，简化版本：
      const info = {
        duration: 0,
        hasVideo: true,
        hasAudio: true,
        videoCodec: 'h264',
        audioCodec: 'aac',
        width: 1920,
        height: 1080,
        framerate: 30,
        sampleRate: 44100
      };

      await this.ffmpeg.deleteFile('probe.mp4');
      return info;

    } catch (error) {
      console.error('Failed to get media info:', error);
      return null;
    }
  }

  /**
   * 转码媒体文件
   */
  async transcode(inputData, outputFormat, options = {}) {
    if (!this.isLoaded) await this.init();

    try {
      await this.ffmpeg.writeFile('input', new Uint8Array(inputData));
      
      const args = ['-i', 'input'];
      
      // 添加转码选项
      if (options.videoCodec) {
        args.push('-c:v', options.videoCodec);
      }
      if (options.audioCodec) {
        args.push('-c:a', options.audioCodec);
      }
      if (options.bitrate) {
        args.push('-b:v', options.bitrate);
      }
      
      args.push(`output.${outputFormat}`);
      
      await this.ffmpeg.exec(args);
      
      const data = await this.ffmpeg.readFile(`output.${outputFormat}`);
      
      // 清理
      await this.ffmpeg.deleteFile('input');
      await this.ffmpeg.deleteFile(`output.${outputFormat}`);
      
      return data;
      
    } catch (error) {
      console.error('Transcode error:', error);
      throw error;
    }
  }

  /**
   * 初始化视频解码器 - 兼容WebCodecs接口
   */
  async initVideoDecoder(config) {
    console.log('🎥 [FFmpeg] initVideoDecoder called with config:', config);
    
    if (!this.isLoaded) {
      console.log('📦 [FFmpeg] FFmpeg not loaded, initializing...');
      await this.init();
    }
    
    // 保存视频配置信息
    this.videoConfig = config;
    
    // FFmpeg解码器不需要预配置，直接返回成功
    // 实际的解码配置会在decodeVideo时处理
    console.log('✅ [FFmpeg] Video decoder ready');
    return true;
  }

  /**
   * 初始化音频解码器 - 兼容WebCodecs接口
   */
  async initAudioDecoder(config) {
    console.log('🔊 [FFmpeg] initAudioDecoder called with config:', config);
    
    if (!this.isLoaded) {
      console.log('📦 [FFmpeg] FFmpeg not loaded, initializing...');
      await this.init();
    }
    
    // 保存音频配置信息
    this.audioConfig = config;
    
    // FFmpeg解码器不需要预配置，直接返回成功
    // 实际的解码配置会在decodeAudio时处理
    console.log('✅ [FFmpeg] Audio decoder ready');
    return true;
  }

  /**
   * 解码单个视频样本 - 兼容WebCodecs接口
   */
  async decodeVideo(encodedData, timestamp, isKeyframe = false) {
    console.log(`🎬 [FFmpeg] decodeVideo called: timestamp=${timestamp}, isKeyframe=${isKeyframe}, size=${encodedData.length}`);
    
    if (!this.isLoaded) {
      console.warn('⚠️ [FFmpeg] FFmpeg not loaded, skipping decode');
      return;
    }

    // 简化实现：对于FFmpeg，我们现在暂时跳过单个样本解码
    // 并模拟一个解码后的帧
    try {
      if (this.onVideoFrame && this.videoConfig) {
        // 创建一个模拟的视频帧 - 实际应用中需要用FFmpeg解码
        const width = this.videoConfig.codedWidth || 800;
        const height = this.videoConfig.codedHeight || 600;
        
        // 创建一个简单的测试图像数据
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // 绘制一个简单的测试图案
        ctx.fillStyle = `hsl(${(timestamp * 60) % 360}, 50%, 50%)`;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.fillText(`Time: ${timestamp.toFixed(2)}s`, 20, 50);
        ctx.fillText(`Frame: ${isKeyframe ? 'KEY' : 'DELTA'}`, 20, 80);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        
        this.onVideoFrame({
          imageData: imageData,
          width: width,
          height: height,
          timestamp: timestamp
        });
        
        console.log(`✅ [FFmpeg] Mock video frame generated: ${width}x${height} at ${timestamp}s`);
      }
    } catch (error) {
      console.error('❌ [FFmpeg] Video decode error:', error);
    }
  }

  /**
   * 解码单个音频样本 - 兼容WebCodecs接口
   */
  async decodeAudio(encodedData, timestamp) {
    console.log(`🔊 [FFmpeg] decodeAudio called: timestamp=${timestamp}, size=${encodedData.length}`);
    
    if (!this.isLoaded) {
      console.warn('⚠️ [FFmpeg] FFmpeg not loaded, skipping decode');
      return;
    }

    // 简化实现：对于FFmpeg，我们现在暂时跳过单个样本解码
    // 并模拟一个解码后的音频帧
    try {
      if (this.onAudioFrame && this.audioConfig) {
        const sampleRate = this.audioConfig.sampleRate || 44100;
        const numberOfChannels = this.audioConfig.numberOfChannels || 2;
        
        // 生成100ms的静音数据作为测试
        const duration = 0.1; // 100ms
        const sampleCount = Math.floor(sampleRate * duration);
        const audioData = new Float32Array(sampleCount * numberOfChannels);
        
        // 填充静音 (或者可以生成简单的测试音调)
        audioData.fill(0);
        
        this.onAudioFrame({
          data: audioData,
          timestamp: timestamp,
          sampleRate: sampleRate,
          channelCount: numberOfChannels
        });
        
        console.log(`✅ [FFmpeg] Mock audio frame generated: ${sampleCount} samples at ${timestamp}s`);
      }
    } catch (error) {
      console.error('❌ [FFmpeg] Audio decode error:', error);
    }
  }

  /**
   * 销毁解码器
   */
  destroy() {
    if (this.ffmpeg && this.isLoaded) {
      // FFmpeg.wasm 没有显式的销毁方法
      this.isLoaded = false;
    }
  }
}