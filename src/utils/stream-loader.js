/**
 * 流式媒体加载器 - 支持边下载边解码边播放
 */
export class StreamLoader {
  constructor() {
    this.url = null;
    this.reader = null;
    this.controller = null;
    this.isLoading = false;
    this.loadedBytes = 0;
    this.totalBytes = 0;
    this.chunks = [];
    this.chunkSize = 64 * 1024; // 64KB chunks
    this.bufferSize = 1024 * 1024; // 1MB buffer
    
    // 回调函数
    this.onChunk = null;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    
    // 快速起播优化
    this.priorityBytes = 256 * 1024; // 前256KB优先加载用于快速起播
    this.headerParsed = false;
    this.moovBoxFound = false;
  }

  /**
   * 开始流式加载
   */
  async startStream(url) {
    this.url = url;
    this.isLoading = true;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      this.totalBytes = parseInt(response.headers.get('content-length')) || 0;
      
      // 检查是否支持范围请求
      const acceptRanges = response.headers.get('accept-ranges');
      const supportsRanges = acceptRanges === 'bytes';
      
      if (supportsRanges && this.totalBytes > 0) {
        // 支持范围请求，使用优化的分段加载
        await this.streamWithRangeRequests();
      } else {
        // 不支持范围请求，使用普通流式加载
        await this.streamSequentially(response);
      }
      
    } catch (error) {
      console.error('Stream loading failed:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * 使用范围请求优化加载
   */
  async streamWithRangeRequests() {
    try {
      // 1. 首先加载文件头部用于快速起播
      await this.loadPriorityChunk(0, this.priorityBytes);
      
      // 2. 如果找到了moov box，继续加载剩余数据
      if (this.moovBoxFound) {
        await this.loadRemainingData(this.priorityBytes);
      } else {
        // 3. 如果头部没有moov box，可能在尾部，先加载尾部
        await this.loadPriorityChunk(this.totalBytes - this.priorityBytes, this.totalBytes);
        
        // 4. 然后加载中间部分
        if (this.priorityBytes < this.totalBytes - this.priorityBytes) {
          await this.loadRemainingData(this.priorityBytes, this.totalBytes - this.priorityBytes);
        }
      }
      
    } catch (error) {
      console.error('Range request streaming failed:', error);
      // 降级到普通流式加载
      await this.streamSequentially();
    }
  }

  /**
   * 加载优先级数据块
   */
  async loadPriorityChunk(start, end) {
    const response = await fetch(this.url, {
      headers: {
        'Range': `bytes=${start}-${end - 1}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Range request failed: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const chunk = new Uint8Array(arrayBuffer);
    
    // 检查是否包含moov box（用于快速起播）
    this.checkForMoovBox(chunk);
    
    this.processChunk(chunk, start);
    this.loadedBytes += chunk.length;
    
    if (this.onProgress) {
      this.onProgress(this.loadedBytes, this.totalBytes);
    }
  }

  /**
   * 加载剩余数据
   */
  async loadRemainingData(startByte, endByte = null) {
    const end = endByte || this.totalBytes;
    let currentByte = startByte;
    
    while (currentByte < end && this.isLoading) {
      const chunkEnd = Math.min(currentByte + this.chunkSize, end);
      
      const response = await fetch(this.url, {
        headers: {
          'Range': `bytes=${currentByte}-${chunkEnd - 1}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Range request failed: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const chunk = new Uint8Array(arrayBuffer);
      
      this.processChunk(chunk, currentByte);
      this.loadedBytes += chunk.length;
      currentByte = chunkEnd;
      
      if (this.onProgress) {
        this.onProgress(this.loadedBytes, this.totalBytes);
      }
      
      // 让出控制权，避免阻塞主线程
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  /**
   * 普通流式加载（降级方案）
   */
  async streamSequentially(response = null) {
    if (!response) {
      response = await fetch(this.url);
    }
    
    this.reader = response.body.getReader();
    
    try {
      while (this.isLoading) {
        const { done, value } = await this.reader.read();
        
        if (done) {
          break;
        }
        
        this.processChunk(value, this.loadedBytes);
        this.loadedBytes += value.length;
        
        if (this.onProgress) {
          this.onProgress(this.loadedBytes, this.totalBytes);
        }
      }
      
      if (this.onComplete) {
        this.onComplete();
      }
      
    } catch (error) {
      console.error('Sequential streaming failed:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  /**
   * 检查数据块中是否包含moov box
   */
  checkForMoovBox(chunk) {
    // 简单的moov box检测
    const moovSignature = new Uint8Array([0x6D, 0x6F, 0x6F, 0x76]); // "moov"
    
    for (let i = 0; i < chunk.length - 4; i++) {
      if (chunk[i] === moovSignature[0] && 
          chunk[i + 1] === moovSignature[1] && 
          chunk[i + 2] === moovSignature[2] && 
          chunk[i + 3] === moovSignature[3]) {
        this.moovBoxFound = true;
        console.log('Found moov box for fast startup');
        break;
      }
    }
  }

  /**
   * 处理数据块
   */
  processChunk(chunk, offset) {
    this.chunks.push({
      data: chunk,
      offset: offset,
      timestamp: Date.now()
    });
    
    if (this.onChunk) {
      this.onChunk(chunk, offset);
    }
    
    // 维护缓冲区大小
    this.maintainBuffer();
  }

  /**
   * 维护缓冲区大小
   */
  maintainBuffer() {
    let totalSize = this.chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    
    // 如果缓冲区过大，移除旧的数据块
    while (totalSize > this.bufferSize && this.chunks.length > 1) {
      const removedChunk = this.chunks.shift();
      totalSize -= removedChunk.data.length;
    }
  }

  /**
   * 获取合并的数据
   */
  getCombinedData() {
    if (this.chunks.length === 0) {
      return new Uint8Array(0);
    }
    
    const totalLength = this.chunks.reduce((sum, chunk) => sum + chunk.data.length, 0);
    const combined = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.chunks) {
      combined.set(chunk.data, offset);
      offset += chunk.data.length;
    }
    
    return combined;
  }

  /**
   * 停止加载
   */
  stop() {
    this.isLoading = false;
    
    if (this.reader) {
      this.reader.cancel();
      this.reader = null;
    }
    
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  /**
   * 获取加载进度
   */
  getProgress() {
    return {
      loaded: this.loadedBytes,
      total: this.totalBytes,
      percentage: this.totalBytes > 0 ? (this.loadedBytes / this.totalBytes) * 100 : 0,
      chunks: this.chunks.length,
      moovFound: this.moovBoxFound
    };
  }
}