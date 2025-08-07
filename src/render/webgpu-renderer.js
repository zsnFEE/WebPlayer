/**
 * WebGPU 视频渲染器 - 支持OffscreenCanvas和高性能渲染
 */
export class WebGPURenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.isInitialized = false;
    this.isSupported = this.checkWebGPUSupport();
    
    // OffscreenCanvas支持
    this.offscreenCanvas = null;
    this.offscreenContext = null;
    this.useOffscreen = false;
    
    // 纹理和缓冲区
    this.videoTexture = null;
    this.sampler = null;
    this.vertexBuffer = null;
    this.uniformBuffer = null;
    
    // 渲染状态
    this.currentFrame = null;
    this.frameCount = 0;
    this.lastRenderTime = 0;
    
    // 性能优化
    this.renderQueue = [];
    this.maxQueueSize = 3; // 最多缓存3帧
  }

  /**
   * 检查WebGPU支持
   */
  checkWebGPUSupport() {
    try {
      return 'gpu' in navigator && typeof navigator.gpu !== 'undefined';
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查OffscreenCanvas支持
   */
  checkOffscreenCanvasSupport() {
    try {
      return typeof OffscreenCanvas !== 'undefined' && 
             typeof createImageBitmap !== 'undefined';
    } catch (error) {
      return false;
    }
  }

  /**
   * 初始化WebGPU
   */
  async init() {
    if (!this.isSupported) {
      throw new Error('WebGPU not supported in this browser');
    }

    try {
      // 获取GPU适配器
      const adapter = await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance',
        forceFallbackAdapter: false
      });
      
      if (!adapter) {
        throw new Error('No appropriate GPUAdapter found. This may be due to hardware limitations or WebGPU not being enabled.');
      }

      // 检查必要的特性和限制
      const requiredFeatures = [];
      const requiredLimits = {
        maxTextureDimension2D: 4096,
        maxTextureArrayLayers: 256
      };

      // 获取设备
      this.device = await adapter.requestDevice({
        requiredFeatures,
        requiredLimits
      });
      
      // 设置设备错误处理
      this.device.addEventListener('uncapturederror', (event) => {
        console.error('WebGPU uncaptured error:', event.error);
      });
      
      // 检查是否可以使用OffscreenCanvas
      if (this.checkOffscreenCanvasSupport()) {
        await this.setupOffscreenRendering();
      }
      
      // 配置主画布上下文
      await this.setupMainCanvas();
      
      // 创建渲染资源
      await this.createRenderResources();
      
      this.isInitialized = true;
      console.log('WebGPU renderer initialized successfully with OffscreenCanvas support:', this.useOffscreen);
      
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      throw error;
    }
  }

  /**
   * 设置OffscreenCanvas渲染
   */
  async setupOffscreenRendering() {
    try {
      // 创建OffscreenCanvas
      this.offscreenCanvas = new OffscreenCanvas(1920, 1080);
      this.offscreenContext = this.offscreenCanvas.getContext('webgpu');
      
      if (this.offscreenContext) {
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        
        this.offscreenContext.configure({
          device: this.device,
          format: canvasFormat,
          alphaMode: 'premultiplied',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });
        
        this.useOffscreen = true;
        console.log('OffscreenCanvas rendering enabled');
      }
    } catch (error) {
      console.warn('OffscreenCanvas setup failed, using main canvas:', error);
      this.useOffscreen = false;
    }
  }

  /**
   * 设置主画布
   */
  async setupMainCanvas() {
    this.context = this.canvas.getContext('webgpu');
    
    if (!this.context) {
      throw new Error('Failed to get WebGPU context from canvas');
    }
    
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    
    this.context.configure({
      device: this.device,
      format: canvasFormat,
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  /**
   * 创建渲染资源
   */
  async createRenderResources() {
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    
    // 创建渲染管线
    await this.createRenderPipeline(canvasFormat);
    
    // 创建顶点缓冲区
    this.createVertexBuffer();
    
    // 创建采样器
    this.createSampler();
    
    // 创建uniform缓冲区
    this.createUniformBuffer();
  }

  /**
   * 创建渲染管线
   */
  async createRenderPipeline(format) {
    // 优化的顶点着色器
    const vertexShaderCode = `
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) texCoord: vec2<f32>
      }

      struct Uniforms {
        transform: mat4x4<f32>,
        opacity: f32,
        colorMatrix: mat4x4<f32>
      }

      @group(0) @binding(2) var<uniform> uniforms: Uniforms;

      @vertex
      fn vs_main(@location(0) position: vec2<f32>, @location(1) texCoord: vec2<f32>) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniforms.transform * vec4<f32>(position, 0.0, 1.0);
        output.texCoord = texCoord;
        return output;
      }
    `;

    // 优化的片段着色器 - 支持YUV色彩空间转换
    const fragmentShaderCode = `
      @group(0) @binding(0) var videoSampler: sampler;
      @group(0) @binding(1) var videoTexture: texture_2d<f32>;
      @group(0) @binding(2) var<uniform> uniforms: Uniforms;

      struct Uniforms {
        transform: mat4x4<f32>,
        opacity: f32,
        colorMatrix: mat4x4<f32>
      }

      @fragment
      fn fs_main(@location(0) texCoord: vec2<f32>) -> @location(0) vec4<f32> {
        var color = textureSample(videoTexture, videoSampler, texCoord);
        
        // 应用色彩矩阵变换（用于YUV到RGB转换）
        color = uniforms.colorMatrix * color;
        
        // 应用透明度
        color.a *= uniforms.opacity;
        
        return color;
      }
    `;

    // 创建着色器模块
    const vertexShader = this.device.createShaderModule({
      code: vertexShaderCode
    });

    const fragmentShader = this.device.createShaderModule({
      code: fragmentShaderCode
    });

    // 创建渲染管线
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: vertexShader,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 4 * 4, // 4 floats (position + texCoord)
          attributes: [
            { format: 'float32x2', offset: 0, shaderLocation: 0 }, // position
            { format: 'float32x2', offset: 8, shaderLocation: 1 }  // texCoord
          ]
        }]
      },
      fragment: {
        module: fragmentShader,
        entryPoint: 'fs_main',
        targets: [{
          format: format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha'
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: 'none'
      }
    });
  }

  /**
   * 创建顶点缓冲区
   */
  createVertexBuffer() {
    // 全屏四边形顶点 (position + texCoord)
    const vertices = new Float32Array([
      -1.0, -1.0,  0.0, 1.0, // 左下
       1.0, -1.0,  1.0, 1.0, // 右下
      -1.0,  1.0,  0.0, 0.0, // 左上
       1.0,  1.0,  1.0, 0.0  // 右上
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
  }

  /**
   * 创建采样器
   */
  createSampler() {
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });
  }

  /**
   * 创建uniform缓冲区
   */
  createUniformBuffer() {
    console.log('🔧 [WebGPU] Creating uniform buffer...');
    
    // Transform matrix (16 floats) + opacity (1 float) + padding (3 floats) + color matrix (16 floats)
    const uniformSize = 16 * 4 + 4 + 12 + 16 * 4; // 256 bytes
    
    // WebGPU要求uniform buffer大小必须是256字节对齐
    const alignedSize = Math.ceil(uniformSize / 256) * 256;
    
    console.log('📊 [WebGPU] Buffer size calculation:', {
      calculated: uniformSize,
      aligned: alignedSize,
      finalSize: Math.max(alignedSize, 256)
    });
    
    this.uniformBuffer = this.device.createBuffer({
      size: Math.max(alignedSize, 256),
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    console.log('✅ [WebGPU] Uniform buffer created with size:', this.uniformBuffer.size);

    // 初始化uniform数据
    this.updateUniforms();
  }

  /**
   * 更新uniform数据
   */
  updateUniforms(opacity = 1.0, colorMatrix = null) {
    if (!this.uniformBuffer) {
      console.warn('⚠️ [WebGPU] No uniform buffer available for update');
      return;
    }
    
    console.log('🔄 [WebGPU] Updating uniforms...');
    
    try {
      // 单位矩阵作为默认变换
      const transform = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);

      // 默认色彩矩阵（RGB恒等变换）
      const defaultColorMatrix = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);

      const finalColorMatrix = colorMatrix || defaultColorMatrix;

      // 获取缓冲区实际大小并创建匹配的数据
      const bufferSize = this.uniformBuffer.size || 256;
      const uniformData = new ArrayBuffer(bufferSize);
      const uniformView = new Float32Array(uniformData);
      
      console.log('📊 [WebGPU] Uniform data setup:', {
        bufferSize: bufferSize,
        dataSize: uniformData.byteLength,
        transformSize: transform.length,
        colorMatrixSize: finalColorMatrix.length
      });
      
      // 设置变换矩阵 (0-15)
      uniformView.set(transform, 0);
      
      // 设置透明度 (16)
      uniformView[16] = opacity;
      
      // 设置色彩矩阵 (20-35) 
      uniformView.set(finalColorMatrix, 20);

      console.log('⬆️ [WebGPU] Writing buffer data...');
      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
      console.log('✅ [WebGPU] Uniforms updated successfully');
      
    } catch (error) {
      console.error('❌ [WebGPU] Failed to update uniforms:', error);
      throw error;
    }
  }

  /**
   * 渲染视频帧 - 优化版本
   */
  async renderFrame(imageData, width, height) {
    console.log('🎬 [WebGPU] renderFrame called:', {
      hasImageData: !!imageData,
      width,
      height,
      isInitialized: this.isInitialized
    });
    
    if (!this.isInitialized || !imageData || !width || !height) {
      console.warn('⚠️ [WebGPU] renderFrame: Invalid parameters or not initialized');
      return;
    }

    try {
      const frameData = { imageData, width, height };
      
      // 如果使用OffscreenCanvas，在后台渲染
      if (this.useOffscreen) {
        console.log('🖼️ [WebGPU] Rendering to OffscreenCanvas');
        await this.renderToOffscreen(frameData);
        await this.transferToMainCanvas();
      } else {
        console.log('🖼️ [WebGPU] Rendering to main canvas');
        await this.renderToMainCanvas(frameData);
      }
      
      this.frameCount++;
      this.lastRenderTime = performance.now();
      console.log('✅ [WebGPU] Frame rendered successfully');
      
    } catch (error) {
      console.error('❌ [WebGPU] Frame rendering failed:', error);
      throw error;
    }
  }

  /**
   * 渲染到OffscreenCanvas
   */
  async renderToOffscreen(frameData) {
    // 创建视频纹理
    await this.updateVideoTexture(frameData);
    
    // 执行渲染
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.offscreenContext.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store'
      }]
    });

    await this.executeRenderPass(renderPass);
    
    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 传输到主画布
   */
  async transferToMainCanvas() {
    // 使用transferToImageBitmap或drawImage将OffscreenCanvas内容传输到主画布
    try {
      const imageBitmap = this.offscreenCanvas.transferToImageBitmap();
      const ctx2d = this.canvas.getContext('2d');
      ctx2d.drawImage(imageBitmap, 0, 0);
    } catch (error) {
      console.warn('Transfer to main canvas failed:', error);
    }
  }

  /**
   * 直接渲染到主画布
   */
  async renderToMainCanvas(frameData) {
    await this.updateVideoTexture(frameData);
    
    const commandEncoder = this.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store'
      }]
    });

    await this.executeRenderPass(renderPass);
    
    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 执行渲染过程
   */
  async executeRenderPass(renderPass) {
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    
    // 创建绑定组
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.videoTexture.createView() },
        { binding: 2, resource: { buffer: this.uniformBuffer } }
      ]
    });
    
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(4, 1, 0, 0); // 绘制四边形
  }

  /**
   * 更新视频纹理
   */
  async updateVideoTexture(frameData) {
    const { imageData, width, height } = frameData;
    
    // 如果纹理尺寸改变，重新创建纹理
    if (!this.videoTexture || 
        this.videoTexture.width !== width || 
        this.videoTexture.height !== height) {
      
      if (this.videoTexture) {
        this.videoTexture.destroy();
      }
      
      this.videoTexture = this.device.createTexture({
        size: { width, height, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
    }
    
    // 更新纹理数据
    if (imageData instanceof ImageData) {
      this.device.queue.writeTexture(
        { texture: this.videoTexture },
        imageData.data,
        { bytesPerRow: width * 4, rowsPerImage: height },
        { width, height, depthOrArrayLayers: 1 }
      );
    } else {
      // 处理其他格式的视频数据
      console.warn('Unsupported frame data format');
    }
  }

  /**
   * 调整画布大小
   */
  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      
      if (this.useOffscreen) {
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
      }
      
      console.log(`Canvas resized to ${width}x${height}`);
    }
  }

  /**
   * 获取渲染统计信息
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      lastRenderTime: this.lastRenderTime,
      useOffscreen: this.useOffscreen,
      queueSize: this.renderQueue.length
    };
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.videoTexture) {
      this.videoTexture.destroy();
    }
    
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
    }
    
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
    }
    
    this.isInitialized = false;
    console.log('WebGPU renderer destroyed');
  }
}