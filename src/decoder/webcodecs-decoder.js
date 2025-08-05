/**
 * WebCodecs 解码器
 */
export class WebCodecsDecoder {
  constructor() {
    this.videoDecoder = null;
    this.audioDecoder = null;
    this.isVideoSupported = 'VideoDecoder' in window;
    this.isAudioSupported = 'AudioDecoder' in window;
    this.videoQueue = [];
    this.audioQueue = [];
    this.onVideoFrame = null;
    this.onAudioFrame = null;
  }

  /**
   * 检查编解码器支持
   */
  async checkSupport(videoCodec, audioCodec) {
    const support = {
      video: false,
      audio: false
    };

    if (this.isVideoSupported && videoCodec) {
      try {
        const videoConfig = {
          codec: videoCodec,
          codedWidth: 1920,
          codedHeight: 1080
        };
        const videoSupport = await VideoDecoder.isConfigSupported(videoConfig);
        support.video = videoSupport.supported;
      } catch (error) {
        console.warn('Video codec not supported:', videoCodec);
      }
    }

    if (this.isAudioSupported && audioCodec) {
      try {
        const audioConfig = {
          codec: audioCodec,
          sampleRate: 44100,
          numberOfChannels: 2
        };
        const audioSupport = await AudioDecoder.isConfigSupported(audioConfig);
        support.audio = audioSupport.supported;
      } catch (error) {
        console.warn('Audio codec not supported:', audioCodec);
      }
    }

    return support;
  }

  /**
   * 初始化视频解码器
   */
  async initVideoDecoder(config) {
    if (!this.isVideoSupported) {
      throw new Error('VideoDecoder not supported');
    }

    this.videoDecoder = new VideoDecoder({
      output: (frame) => {
        this.handleVideoFrame(frame);
      },
      error: (error) => {
        console.error('Video decoder error:', error);
      }
    });

    try {
      this.videoDecoder.configure(config);
      console.log('Video decoder initialized:', config);
    } catch (error) {
      console.error('Failed to configure video decoder:', error);
      throw error;
    }
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
      // 将VideoFrame转换为ImageData
      const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(frame, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, frame.displayWidth, frame.displayHeight);
      
      this.onVideoFrame({
        data: imageData.data,
        width: frame.displayWidth,
        height: frame.displayHeight,
        timestamp: frame.timestamp / 1000000 // 转换为秒
      });
    }
    
    frame.close();
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

    try {
      const chunk = new EncodedVideoChunk({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: timestamp * 1000000, // 转换为微秒
        data: encodedData
      });

      this.videoDecoder.decode(chunk);
    } catch (error) {
      console.error('Video decode error:', error);
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