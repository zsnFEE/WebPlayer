/**
 * SharedArrayBuffer 数据管理工具
 */
export class SharedBufferManager {
  constructor() {
    this.buffers = new Map();
    this.isSupported = typeof SharedArrayBuffer !== 'undefined';
  }

  /**
   * 创建共享缓冲区
   */
  createBuffer(id, size) {
    if (!this.isSupported) {
      console.warn('SharedArrayBuffer not supported, falling back to ArrayBuffer');
      const buffer = new ArrayBuffer(size);
      this.buffers.set(id, buffer);
      return buffer;
    }

    const buffer = new SharedArrayBuffer(size);
    this.buffers.set(id, buffer);
    return buffer;
  }

  /**
   * 获取缓冲区
   */
  getBuffer(id) {
    return this.buffers.get(id);
  }

  /**
   * 删除缓冲区
   */
  removeBuffer(id) {
    this.buffers.delete(id);
  }

  /**
   * 创建视频帧缓冲区
   */
  createVideoFrameBuffer(width, height, format = 'RGBA') {
    const bytesPerPixel = format === 'RGBA' ? 4 : 3;
    const size = width * height * bytesPerPixel;
    const id = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const buffer = this.createBuffer(id, size);
    return {
      id,
      buffer,
      view: new Uint8Array(buffer),
      width,
      height,
      format,
      size
    };
  }

  /**
   * 创建音频帧缓冲区
   */
  createAudioFrameBuffer(sampleCount, channelCount = 2) {
    const size = sampleCount * channelCount * 4; // Float32Array
    const id = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const buffer = this.createBuffer(id, size);
    return {
      id,
      buffer,
      view: new Float32Array(buffer),
      sampleCount,
      channelCount,
      size
    };
  }
}

export const sharedBufferManager = new SharedBufferManager();