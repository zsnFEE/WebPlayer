/**
 * WebGPU 视频渲染器
 */
export class WebGPURenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.isInitialized = false;
    this.isSupported = 'gpu' in navigator;
  }

  /**
   * 初始化WebGPU
   */
  async init() {
    if (!this.isSupported) {
      throw new Error('WebGPU not supported');
    }

    try {
      // 获取GPU适配器
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('No appropriate GPUAdapter found');
      }

      // 获取设备
      this.device = await adapter.requestDevice();
      
      // 配置画布上下文
      this.context = this.canvas.getContext('webgpu');
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      
      this.context.configure({
        device: this.device,
        format: canvasFormat,
      });

      // 创建渲染管线
      await this.createRenderPipeline(canvasFormat);
      
      this.isInitialized = true;
      console.log('WebGPU renderer initialized');
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      throw error;
    }
  }

  /**
   * 创建渲染管线
   */
  async createRenderPipeline(format) {
    // 顶点着色器
    const vertexShaderCode = `
      @vertex
      fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 6>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>(-1.0,  1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>( 1.0,  1.0),
          vec2<f32>(-1.0,  1.0)
        );
        return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
      }
    `;

    // 片段着色器
    const fragmentShaderCode = `
      @group(0) @binding(0) var videoSampler: sampler;
      @group(0) @binding(1) var videoTexture: texture_2d<f32>;

      @fragment
      fn fs_main(@builtin(position) coord: vec4<f32>) -> @location(0) vec4<f32> {
        let uv = coord.xy / vec2<f32>(${this.canvas.width}.0, ${this.canvas.height}.0);
        let flippedUV = vec2<f32>(uv.x, 1.0 - uv.y);
        return textureSample(videoTexture, videoSampler, flippedUV);
      }
    `;

    const vertexShader = this.device.createShaderModule({
      code: vertexShaderCode,
    });

    const fragmentShader = this.device.createShaderModule({
      code: fragmentShaderCode,
    });

    // 创建绑定组布局
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {},
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {},
        },
      ],
    });

    // 创建管线布局
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    });

    // 创建渲染管线
    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: vertexShader,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: fragmentShader,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    // 创建采样器
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });
  }

  /**
   * 渲染视频帧
   */
  renderFrame(imageData, width, height) {
    if (!this.isInitialized) return;

    try {
      // 创建纹理
      const texture = this.device.createTexture({
        size: [width, height, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });

      // 上传图像数据
      this.device.queue.writeTexture(
        { texture },
        imageData,
        { bytesPerRow: width * 4 },
        { width, height, depthOrArrayLayers: 1 }
      );

      // 创建绑定组
      const bindGroup = this.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: texture.createView() },
        ],
      });

      // 开始渲染
      const commandEncoder = this.device.createCommandEncoder();
      const renderPassDescriptor = {
        colorAttachments: [
          {
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      };

      const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
      passEncoder.setPipeline(this.pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(6);
      passEncoder.end();

      this.device.queue.submit([commandEncoder.finish()]);

      // 清理纹理
      texture.destroy();
    } catch (error) {
      console.error('WebGPU render error:', error);
    }
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    if (this.device) {
      this.device.destroy();
    }
    this.isInitialized = false;
  }
}