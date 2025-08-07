// 动态导入MP4Box以避免初始化时的crypto错误
let MP4Box = null;

async function getMP4Box() {
  if (!MP4Box) {
    try {
      console.log('Loading MP4Box library...');
      const mp4boxModule = await import('mp4box');
      MP4Box = mp4boxModule.default || mp4boxModule;
      
      // 验证MP4Box对象
      if (!MP4Box || typeof MP4Box.createFile !== 'function') {
        throw new Error('MP4Box library does not have required methods');
      }
      
      console.log('MP4Box library loaded successfully');
    } catch (error) {
      console.error('Failed to load MP4Box:', error);
      MP4Box = null; // 重置以便重试
      throw new Error(`MP4Box is required for video parsing: ${error.message}`);
    }
  }
  return MP4Box;
}

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
  async init() {
    try {
      // 如果已经初始化，直接返回
      if (this.mp4boxfile) {
        return;
      }

      // 动态加载MP4Box
      const MP4BoxLib = await getMP4Box();
      
      // 确保MP4Box库加载成功
      if (!MP4BoxLib || typeof MP4BoxLib.createFile !== 'function') {
        throw new Error('MP4Box library not properly loaded');
      }
      
      this.mp4boxfile = MP4BoxLib.createFile();
      
      // 验证mp4boxfile创建成功
      if (!this.mp4boxfile) {
        throw new Error('Failed to create MP4Box file instance');
      }
      
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
      
    } catch (error) {
      console.error('Failed to initialize MP4 parser:', error);
      this.mp4boxfile = null; // 确保失败时重置
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
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
    
    // 构建完整的媒体信息对象
    const mediaInfo = {
      ...info,
      hasVideo: !!this.videoTrack,
      hasAudio: !!this.audioTrack,
      isStreaming: this.isStreaming,
      fastStartup: this.fastStartup,
      supportsSeek: !this.isStreaming || this.streamLoader.totalBytes > 0,
      videoTrack: this.videoTrack,
      audioTrack: this.audioTrack
    };
    
    console.log('🎯 [MP4Parser] Sending complete media info:', mediaInfo);
    
    if (this.onReady) {
      this.onReady(mediaInfo);
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
  async appendBuffer(buffer) {
    console.log('📦 [MP4Parser] appendBuffer called');
    
    try {
      // 确保MP4Box已初始化
      if (!this.mp4boxfile) {
        console.log('🔧 [MP4Parser] MP4Box not initialized, initializing...');
        await this.init();
      }

      // 再次检查MP4Box是否成功初始化
      if (!this.mp4boxfile) {
        throw new Error('MP4Box failed to initialize');
      }

      // 验证buffer
      if (!buffer) {
        throw new Error('Buffer is null or undefined');
      }

      // 确保buffer是ArrayBuffer
      let arrayBuffer;
      if (buffer instanceof ArrayBuffer) {
        arrayBuffer = buffer;
      } else if (buffer.buffer instanceof ArrayBuffer) {
        arrayBuffer = buffer.buffer;
      } else {
        throw new Error('Invalid buffer type');
      }

      // 验证ArrayBuffer
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Empty or invalid ArrayBuffer');
      }
      
      console.log(`📊 [MP4Parser] Processing buffer: ${arrayBuffer.byteLength} bytes`);
      
      // 设置文件位置信息
      arrayBuffer.fileStart = this.bufferOffset;
      this.bufferOffset += arrayBuffer.byteLength;

      console.log('⬆️ [MP4Parser] Calling mp4boxfile.appendBuffer...');
      
      // 添加到MP4Box
      const nextExpectedOffset = this.mp4boxfile.appendBuffer(arrayBuffer);
      
      console.log(`✅ [MP4Parser] appendBuffer successful, next offset: ${nextExpectedOffset}`);
      
      // 立即启动处理，确保onReady被触发
      if (!this.isInitialized) {
        console.log('🚀 [MP4Parser] Starting MP4Box processing...');
        this.mp4boxfile.start();
        
        // 设置超时检查
        setTimeout(() => {
          if (!this.isInitialized) {
            console.warn('⚠️ [MP4Parser] MP4Box onReady not triggered after 3 seconds');
            this.checkForcedInfo();
          }
        }, 3000);
      }
      
      return nextExpectedOffset;
      
    } catch (error) {
      console.error('❌ [MP4Parser] Error in appendBuffer:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * 强制检查MP4信息（当onReady未触发时）
   */
  checkForcedInfo() {
    console.log('🔍 [MP4Parser] Attempting to force get MP4 info...');
    
    if (this.mp4boxfile) {
      try {
        // 尝试强制获取信息
        const info = this.mp4boxfile.getInfo && this.mp4boxfile.getInfo();
        if (info && info.tracks && info.tracks.length > 0) {
          console.log('✅ [MP4Parser] Force info retrieval successful!');
          this.handleReady(info);
        } else {
          console.warn('⚠️ [MP4Parser] Force info retrieval failed - no tracks found');
        }
      } catch (error) {
        console.error('❌ [MP4Parser] Force info retrieval error:', error);
      }
    }
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