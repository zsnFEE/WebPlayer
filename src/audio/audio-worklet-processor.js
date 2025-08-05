/**
 * AudioWorklet 音频处理器
 */
class AudioWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.bufferSize = 4096;
    this.sampleRate = 44100;
    this.channelCount = 2;
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.playing = false;
    
    // 音频缓冲队列
    this.audioQueue = [];
    this.currentSample = 0;
    this.targetTime = 0;
    
    // 接收来自主线程的消息
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    console.log('AudioWorkletProcessor initialized');
  }

  /**
   * 处理来自主线程的消息
   */
  handleMessage(data) {
    switch (data.type) {
      case 'config':
        this.sampleRate = data.sampleRate || this.sampleRate;
        this.channelCount = data.channelCount || this.channelCount;
        break;
        
      case 'audio-data':
        this.addAudioData(data.buffer, data.timestamp);
        break;
        
      case 'play':
        this.playing = true;
        break;
        
      case 'pause':
        this.playing = false;
        break;
        
      case 'volume':
        this.volume = Math.max(0, Math.min(1, data.volume));
        break;
        
      case 'playback-rate':
        this.playbackRate = Math.max(0.1, Math.min(4, data.rate));
        break;
        
      case 'seek':
        this.seek(data.time);
        break;
        
      case 'clear':
        this.audioQueue = [];
        this.currentSample = 0;
        break;
    }
  }

  /**
   * 添加音频数据到队列
   */
  addAudioData(buffer, timestamp) {
    // 如果是SharedArrayBuffer，创建Float32Array视图
    const audioData = buffer instanceof SharedArrayBuffer 
      ? new Float32Array(buffer)
      : new Float32Array(buffer);
      
    this.audioQueue.push({
      data: audioData,
      timestamp: timestamp,
      consumed: 0
    });
    
    // 保持队列大小合理
    if (this.audioQueue.length > 100) {
      this.audioQueue.shift();
    }
  }

  /**
   * 跳转到指定时间
   */
  seek(targetTime) {
    this.targetTime = targetTime;
    
    // 清除当前队列中过时的音频数据
    this.audioQueue = this.audioQueue.filter(item => 
      item.timestamp >= targetTime - 0.1 // 保留100ms缓冲
    );
    
    this.currentSample = 0;
  }

  /**
   * 音频处理主函数
   */
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const frameCount = output[0].length;
    
    if (!this.playing || this.audioQueue.length === 0) {
      // 输出静音
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0);
      }
      return true;
    }

    // 处理倍速播放
    const effectiveSampleRate = this.sampleRate * this.playbackRate;
    const sampleStep = effectiveSampleRate / this.sampleRate;

    for (let i = 0; i < frameCount; i++) {
      const currentAudioItem = this.audioQueue[0];
      
      if (!currentAudioItem) {
        // 没有音频数据，输出静音
        for (let channel = 0; channel < output.length; channel++) {
          output[channel][i] = 0;
        }
        continue;
      }

      const sampleIndex = Math.floor(currentAudioItem.consumed);
      const nextSampleIndex = sampleIndex + 1;
      
      // 检查是否有足够的样本数据
      if (nextSampleIndex >= currentAudioItem.data.length / this.channelCount) {
        this.audioQueue.shift();
        continue;
      }

      // 线性插值 (用于倍速播放)
      const fraction = currentAudioItem.consumed - sampleIndex;
      
      for (let channel = 0; channel < Math.min(output.length, this.channelCount); channel++) {
        const sample1 = currentAudioItem.data[sampleIndex * this.channelCount + channel] || 0;
        const sample2 = currentAudioItem.data[nextSampleIndex * this.channelCount + channel] || 0;
        
        const interpolatedSample = sample1 + (sample2 - sample1) * fraction;
        output[channel][i] = interpolatedSample * this.volume;
      }

      currentAudioItem.consumed += sampleStep;
    }

    // 报告当前播放时间
    this.port.postMessage({
      type: 'time-update',
      currentTime: this.getCurrentTime()
    });

    return true;
  }

  /**
   * 获取当前播放时间
   */
  getCurrentTime() {
    if (this.audioQueue.length === 0) return 0;
    
    const currentItem = this.audioQueue[0];
    const sampleOffset = currentItem.consumed / this.channelCount;
    const timeOffset = sampleOffset / this.sampleRate;
    
    return currentItem.timestamp + timeOffset;
  }
}

registerProcessor('audio-worklet-processor', AudioWorkletProcessor);