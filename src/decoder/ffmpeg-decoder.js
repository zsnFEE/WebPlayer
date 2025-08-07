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
  }

  /**
   * 检查FFmpeg支持
   */
  checkSupport() {
    try {
      // 检查基本的WebAssembly支持
      return typeof WebAssembly !== 'undefined' && 
             typeof SharedArrayBuffer !== 'undefined';
    } catch (error) {
      console.warn('FFmpeg support check failed:', error);
      return false;
    }
  }

  /**
   * 初始化FFmpeg
   */
  async init() {
    if (this.isLoaded) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this._initializeFFmpeg();
    return this.initializationPromise;
  }

  async _initializeFFmpeg() {
    try {
      // 检查支持
      if (!this.checkSupport()) {
        throw new Error('FFmpeg not supported in this environment');
      }

      // 动态导入FFmpeg以避免初始化错误
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      
      this.ffmpeg = new FFmpeg();

      // 加载FFmpeg核心文件
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      
      // 设置日志处理
      this.ffmpeg.on('log', ({ message }) => {
        console.log('FFmpeg:', message);
      });

      // 设置进度处理
      this.ffmpeg.on('progress', ({ progress, time }) => {
        console.log(`FFmpeg progress: ${progress}% (${time}s)`);
      });

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
      console.log('FFmpeg loaded successfully');
      
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      this.isLoaded = false;
      
      // 重置初始化Promise以允许重试
      this.initializationPromise = null;
      
      throw new Error(`FFmpeg initialization failed: ${error.message}`);
    }
  }

  /**
   * 解码视频文件
   */
  async decodeVideo(videoData, outputFormat = 'rawvideo') {
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
   * 解码音频文件
   */
  async decodeAudio(audioData) {
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
   * 销毁解码器
   */
  destroy() {
    if (this.ffmpeg && this.isLoaded) {
      // FFmpeg.wasm 没有显式的销毁方法
      this.isLoaded = false;
    }
  }
}