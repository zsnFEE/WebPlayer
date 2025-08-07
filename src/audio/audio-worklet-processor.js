/**
 * AudioWorklet 音频处理器 - 支持多声道音频
 */
class WebAVAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    this.bufferSize = 4096;
    this.sampleRate = 44100;
    this.channelCount = 2;
    this.maxChannels = 8; // 支持最多8声道
    this.volume = 1.0;
    this.playbackRate = 1.0;
    this.playing = false;
    
    // 音频缓冲队列
    this.audioQueue = [];
    this.currentSample = 0;
    this.targetTime = 0;
    
    // 多声道支持
    this.channelMapping = null; // 声道映射配置
    this.channelMixMatrix = null; // 声道混音矩阵
    this.surroundMode = false; // 环绕声模式
    
    // 音频处理
    this.resampleBuffer = [];
    this.interpolationFactor = 1.0;
    
    // 接收来自主线程的消息
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    console.log('WebAVAudioProcessor initialized with multichannel support');
  }

  /**
   * 处理来自主线程的消息
   */
  handleMessage(data) {
    switch (data.type) {
      case 'config':
        this.sampleRate = data.sampleRate || this.sampleRate;
        this.channelCount = Math.min(data.channelCount || this.channelCount, this.maxChannels);
        this.setupChannelMapping(data.channelLayout);
        break;
        
      case 'audio-data':
        this.addAudioData(data.buffer, data.timestamp, data.channelCount);
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
        this.updateInterpolationFactor();
        break;
        
      case 'seek':
        this.seek(data.time);
        break;
        
      case 'clear':
        this.audioQueue = [];
        this.currentSample = 0;
        break;
        
      case 'channel-mapping':
        this.setupChannelMapping(data.mapping);
        break;
        
      case 'surround-mode':
        this.surroundMode = data.enabled;
        this.setupSurroundProcessing();
        break;
    }
  }

  /**
   * 设置声道映射
   */
  setupChannelMapping(channelLayout) {
    if (!channelLayout) {
      // 默认立体声映射
      this.channelMapping = { 0: 0, 1: 1 }; // 输入声道 -> 输出声道
      return;
    }
    
    // 根据声道布局设置映射
    switch (channelLayout) {
      case 'mono':
        this.channelMapping = { 0: [0, 1] }; // 单声道映射到立体声
        break;
        
      case 'stereo':
        this.channelMapping = { 0: 0, 1: 1 };
        break;
        
      case '5.1':
        // 5.1环绕声 (L, R, C, LFE, SL, SR)
        this.channelMapping = {
          0: 0, // Left -> Left
          1: 1, // Right -> Right
          2: [0, 1], // Center -> Both
          3: [0, 1], // LFE -> Both (low-pass filtered)
          4: 0, // Surround Left -> Left
          5: 1  // Surround Right -> Right
        };
        this.setupMixMatrix();
        break;
        
      case '7.1':
        // 7.1环绕声
        this.channelMapping = {
          0: 0, 1: 1, 2: [0, 1], 3: [0, 1],
          4: 0, 5: 1, 6: 0, 7: 1
        };
        this.setupMixMatrix();
        break;
        
      default:
        this.channelMapping = { 0: 0, 1: 1 };
    }
  }

  /**
   * 设置混音矩阵
   */
  setupMixMatrix() {
    // 为多声道到立体声的下混设置权重
    this.channelMixMatrix = {
      center: 0.707,    // 中央声道权重
      lfe: 0.5,         // 低频声道权重
      surround: 0.866,  // 环绕声道权重
      rear: 0.6         // 后环绕声道权重
    };
  }

  /**
   * 设置环绕声处理
   */
  setupSurroundProcessing() {
    if (this.surroundMode) {
      // 启用虚拟环绕声处理
      console.log('Virtual surround sound processing enabled');
    }
  }

  /**
   * 更新插值因子
   */
  updateInterpolationFactor() {
    this.interpolationFactor = 1.0 / this.playbackRate;
  }

  /**
   * 添加音频数据到队列
   */
  addAudioData(buffer, timestamp, inputChannels = 2) {
    // 如果是SharedArrayBuffer，创建Float32Array视图
    const audioData = buffer instanceof SharedArrayBuffer 
      ? new Float32Array(buffer)
      : new Float32Array(buffer);
    
    // 计算每个声道的样本数
    const samplesPerChannel = audioData.length / inputChannels;
    
    this.audioQueue.push({
      data: audioData,
      timestamp: timestamp,
      consumed: 0,
      inputChannels: inputChannels,
      samplesPerChannel: samplesPerChannel
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
    this.resampleBuffer = [];
  }

  /**
   * 音频处理主函数
   */
  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const frameCount = output[0].length;
    const outputChannels = output.length;
    
    if (!this.playing || this.audioQueue.length === 0) {
      // 输出静音
      for (let channel = 0; channel < outputChannels; channel++) {
        output[channel].fill(0);
      }
      return true;
    }

    // 处理倍速播放和多声道音频
    this.processMultichannelAudio(output, frameCount, outputChannels);
    
    return true;
  }

  /**
   * 处理多声道音频
   */
  processMultichannelAudio(output, frameCount, outputChannels) {
    const leftChannel = output[0];
    const rightChannel = output[1] || output[0];
    
    for (let i = 0; i < frameCount; i++) {
      let leftSample = 0;
      let rightSample = 0;
      
      // 从队列中获取样本
      const samples = this.getNextSamples();
      
      if (samples) {
        // 多声道下混到立体声
        const mixedSamples = this.mixMultichannelToStereo(samples);
        leftSample = mixedSamples.left;
        rightSample = mixedSamples.right;
        
        // 应用音量
        leftSample *= this.volume;
        rightSample *= this.volume;
        
        // 应用虚拟环绕声处理
        if (this.surroundMode) {
          const processed = this.applyVirtualSurround(leftSample, rightSample);
          leftSample = processed.left;
          rightSample = processed.right;
        }
      }
      
      leftChannel[i] = leftSample;
      if (rightChannel !== leftChannel) {
        rightChannel[i] = rightSample;
      }
    }
  }

  /**
   * 获取下一个样本（支持重采样）
   */
  getNextSamples() {
    if (this.audioQueue.length === 0) {
      return null;
    }
    
    const currentItem = this.audioQueue[0];
    const inputChannels = currentItem.inputChannels;
    const samplesPerChannel = currentItem.samplesPerChannel;
    
    // 计算当前样本索引
    const sampleIndex = Math.floor(currentItem.consumed);
    
    if (sampleIndex >= samplesPerChannel) {
      // 当前缓冲区已用完，移到下一个
      this.audioQueue.shift();
      return this.getNextSamples();
    }
    
    // 提取多声道样本
    const samples = [];
    for (let ch = 0; ch < inputChannels; ch++) {
      const dataIndex = sampleIndex * inputChannels + ch;
      samples[ch] = currentItem.data[dataIndex] || 0;
    }
    
    // 更新消费计数（考虑播放速度）
    currentItem.consumed += this.interpolationFactor;
    
    return samples;
  }

  /**
   * 多声道到立体声下混
   */
  mixMultichannelToStereo(samples) {
    const numChannels = samples.length;
    let left = 0;
    let right = 0;
    
    if (numChannels === 1) {
      // 单声道
      left = right = samples[0];
    } else if (numChannels === 2) {
      // 立体声
      left = samples[0];
      right = samples[1];
    } else if (numChannels >= 6) {
      // 5.1或更多声道 (L, R, C, LFE, SL, SR)
      const L = samples[0] || 0;
      const R = samples[1] || 0;
      const C = samples[2] || 0;
      const LFE = samples[3] || 0;
      const SL = samples[4] || 0;
      const SR = samples[5] || 0;
      
      // 使用混音矩阵进行下混
      left = L + 
             C * this.channelMixMatrix.center + 
             LFE * this.channelMixMatrix.lfe + 
             SL * this.channelMixMatrix.surround;
             
      right = R + 
              C * this.channelMixMatrix.center + 
              LFE * this.channelMixMatrix.lfe + 
              SR * this.channelMixMatrix.surround;
              
      // 如果有后环绕声道 (7.1)
      if (numChannels >= 8) {
        const SBL = samples[6] || 0;
        const SBR = samples[7] || 0;
        left += SBL * this.channelMixMatrix.rear;
        right += SBR * this.channelMixMatrix.rear;
      }
    } else {
      // 其他配置，简单平均分配
      left = samples[0] || 0;
      right = samples[1] || samples[0] || 0;
    }
    
    // 防止削波
    left = Math.max(-1, Math.min(1, left));
    right = Math.max(-1, Math.min(1, right));
    
    return { left, right };
  }

  /**
   * 应用虚拟环绕声处理
   */
  applyVirtualSurround(left, right) {
    // 简单的虚拟环绕声处理
    // 可以实现更复杂的HRTF或Dolby Atmos算法
    const crossfeed = 0.3;
    const delay = 0.1;
    
    const processedLeft = left + right * crossfeed * delay;
    const processedRight = right + left * crossfeed * delay;
    
    return {
      left: processedLeft,
      right: processedRight
    };
  }
}

// 注册AudioWorklet处理器
registerProcessor('audio-worklet-processor', WebAVAudioProcessor);