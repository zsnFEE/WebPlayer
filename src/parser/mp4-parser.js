import MP4Box from 'mp4box';
import { StreamLoader } from '../utils/stream-loader.js';

/**
 * MP4 解析器 - 支持流式解析和快速起播
 */
export class MP4Parser {
  constructor() {
    this.mp4boxfile = null;
    this.info = null;
    this.isInitialized = false;
    this.videoTrack = null;
    this.audioTrack = null;
    this.onReady = null;
    this.onSamples = null;
    this.onError = null;
    this.bufferOffset = 0;
    
    // 流式加载相关
    this.streamLoader = new StreamLoader();
    this.isStreaming = false;
    this.fastStartup = false;
    this.minBufferForStart = 64 * 1024; // 64KB最小缓冲用于启动
    
    // 回调函数
    this.onProgress = null;
    this.onFastStartReady = null;
  }

  /**
   * 初始化解析器
   */
  init() {
    this.mp4boxfile = MP4Box.createFile();
    
    // 监听信息解析完成
    this.mp4boxfile.onReady = (info) => {
      this.handleReady(info);
    };

    // 监听样本数据
    this.mp4boxfile.onSamples = (id, user, samples) => {
      this.handleSamples(id, user, samples);
    };

    // 监听错误
    this.mp4boxfile.onError = (error) => {
      console.error('MP4Box error:', error);
      if (this.onError) {
        this.onError(error);
      }
    };

    // 设置流式加载器回调
    this.setupStreamLoader();

    console.log('MP4 parser initialized with streaming support');
  }

  /**
   * 设置流式加载器
   */
  setupStreamLoader() {
    this.streamLoader.onChunk = (chunk, offset) => {
      this.handleStreamChunk(chunk, offset);
    };
    
    this.streamLoader.onProgress = (loaded, total) => {
      if (this.onProgress) {
        this.onProgress(loaded, total);
      }
      
      // 检查是否可以快速起播
      if (!this.fastStartup && loaded >= this.minBufferForStart && this.streamLoader.moovBoxFound) {
        this.fastStartup = true;
        if (this.onFastStartReady) {
          this.onFastStartReady();
        }
      }
    };
    
    this.streamLoader.onError = (error) => {
      if (this.onError) {
        this.onError(error);
      }
    };
  }

  /**
   * 处理流式数据块
   */
  handleStreamChunk(chunk, offset) {
    try {
      // 为MP4Box准备数据
      const buffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      buffer.fileStart = this.bufferOffset;
      
      // 向MP4Box传递数据
      this.mp4boxfile.appendBuffer(buffer);
      this.bufferOffset += chunk.length;
      
      // 定期刷新以处理新数据
      this.mp4boxfile.flush();
      
    } catch (error) {
      console.error('Error processing stream chunk:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * 从URL流式加载文件
   */
  async loadFromStream(url) {
    this.isStreaming = true;
    
    try {
      await this.streamLoader.startStream(url);
    } catch (error) {
      console.error('Stream loading failed:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * 处理媒体信息就绪
   */
  handleReady(info) {
    this.info = info;
    console.log('MP4 info:', info);

    // 查找视频和音频轨道
    for (const track of info.tracks) {
      if (track.type === 'video' && !this.videoTrack) {
        this.videoTrack = track;
        console.log('Video track found:', track);
        
        // 设置提取参数
        this.mp4boxfile.setExtractionOptions(track.id, null, {
          nbSamples: 100 // 批量提取100个样本
        });
        
      } else if (track.type === 'audio' && !this.audioTrack) {
        this.audioTrack = track;
        console.log('Audio track found:', track);
        
        // 设置提取参数
        this.mp4boxfile.setExtractionOptions(track.id, null, {
          nbSamples: 100 // 批量提取100个样本
        });
      }
    }

    // 开始提取样本数据
    if (this.videoTrack) {
      this.mp4boxfile.start();
    }
    if (this.audioTrack) {
      this.mp4boxfile.start();
    }

    this.isInitialized = true;
    
    if (this.onReady) {
      this.onReady({
        ...info,
        isStreaming: this.isStreaming,
        fastStartup: this.fastStartup,
        supportsSeek: !this.isStreaming || this.streamLoader.totalBytes > 0
      });
    }
  }

  /**
   * 处理样本数据
   */
  handleSamples(trackId, user, samples) {
    if (this.onSamples) {
      this.onSamples(trackId, samples);
    }
  }

  /**
   * 添加数据块
   */
  appendBuffer(buffer) {
    if (!this.mp4boxfile) {
      this.init();
    }

    // 确保buffer是ArrayBuffer
    const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
    
    // 设置文件位置信息
    arrayBuffer.fileStart = this.bufferOffset;
    this.bufferOffset += arrayBuffer.byteLength;

    // 添加到MP4Box
    const nextExpectedOffset = this.mp4boxfile.appendBuffer(arrayBuffer);
    
    return nextExpectedOffset;
  }

  /**
   * 开始提取样本
   */
  start() {
    if (!this.isInitialized) {
      console.warn('Parser not ready');
      return;
    }

    if (this.videoTrack) {
      this.mp4boxfile.start();
    }
    
    if (this.audioTrack) {
      this.mp4boxfile.start();
    }
  }

  /**
   * 停止提取
   */
  stop() {
    if (this.mp4boxfile) {
      this.mp4boxfile.stop();
    }
  }

  /**
   * 跳转到指定时间
   */
  seek(time, useRAP = true) {
    if (!this.isInitialized) return;

    const seekInfo = this.mp4boxfile.seek(time, useRAP);
    return seekInfo;
  }

  /**
   * 获取视频轨道配置 (用于WebCodecs)
   */
  getVideoDecoderConfig() {
    if (!this.videoTrack) return null;

    const track = this.videoTrack;
    const config = {
      codec: this.getWebCodecsCodec(track.codec),
      codedWidth: track.video.width,
      codedHeight: track.video.height,
    };

    // 添加描述信息 (如果有)
    if (track.hvcC || track.avcC) {
      const initData = track.hvcC || track.avcC;
      config.description = new Uint8Array(initData);
    }

    return config;
  }

  /**
   * 获取音频轨道配置 (用于WebCodecs)
   */
  getAudioDecoderConfig() {
    if (!this.audioTrack) return null;

    const track = this.audioTrack;
    const config = {
      codec: this.getWebCodecsCodec(track.codec),
      sampleRate: track.audio.sample_rate,
      numberOfChannels: track.audio.channel_count,
    };

    // 添加描述信息 (如果有)
    if (track.esds) {
      config.description = new Uint8Array(track.esds);
    }

    return config;
  }

  /**
   * 转换编解码器名称为WebCodecs格式
   */
  getWebCodecsCodec(mp4Codec) {
    const codecMap = {
      'avc1': 'avc1.42E01E', // H.264 Baseline
      'avc3': 'avc1.42E01E',
      'hev1': 'hev1.1.6.L93.B0', // H.265
      'hvc1': 'hev1.1.6.L93.B0',
      'mp4a': 'mp4a.40.2', // AAC-LC
      'opus': 'opus',
      'vp09': 'vp09.00.10.08'
    };

    return codecMap[mp4Codec] || mp4Codec;
  }

  /**
   * 获取样本数据
   */
  getSampleData(sample) {
    return {
      data: new Uint8Array(sample.data),
      timestamp: sample.cts / sample.timescale,
      duration: sample.duration / sample.timescale,
      isSync: sample.is_sync,
      size: sample.size
    };
  }

  /**
   * 创建分片信息
   */
  createFragmentInfo() {
    if (!this.info) return null;

    return {
      brands: this.info.brands,
      timescale: this.info.timescale,
      duration: this.info.duration,
      created: this.info.created,
      modified: this.info.modified
    };
  }

  /**
   * 获取轨道信息
   */
  getTrackInfo(trackId) {
    if (!this.info) return null;

    return this.info.tracks.find(track => track.id === trackId);
  }

  /**
   * 检查是否支持快速启动
   */
  canFastStart() {
    if (!this.info) return false;
    
    // 检查moov box是否在mdat之前
    return this.info.progressive;
  }

  /**
   * 获取缓冲信息
   */
  getBufferInfo() {
    return {
      offset: this.bufferOffset,
      initialized: this.isInitialized,
      hasVideo: !!this.videoTrack,
      hasAudio: !!this.audioTrack
    };
  }

  /**
   * 重置解析器
   */
  reset() {
    this.stop();
    this.mp4boxfile = null;
    this.info = null;
    this.isInitialized = false;
    this.videoTrack = null;
    this.audioTrack = null;
    this.bufferOffset = 0;
  }

  /**
   * 销毁解析器
   */
  destroy() {
    this.reset();
  }
}