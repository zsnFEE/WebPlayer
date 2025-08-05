/**
 * WebGL 视频渲染器 (WebGPU 后备方案)
 */
export class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.isInitialized = false;
  }

  /**
   * 初始化WebGL
   */
  async init() {
    try {
      this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
      if (!this.gl) {
        throw new Error('WebGL not supported');
      }

      // 创建着色器程序
      this.createShaderProgram();
      
      // 创建顶点缓冲区
      this.createVertexBuffer();
      
      // 创建纹理
      this.createTexture();
      
      this.isInitialized = true;
      console.log('WebGL renderer initialized');
    } catch (error) {
      console.error('Failed to initialize WebGL:', error);
      throw error;
    }
  }

  /**
   * 创建着色器程序
   */
  createShaderProgram() {
    const gl = this.gl;

    // 顶点着色器源码
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // 片段着色器源码
    const fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_texCoord;
      
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `;

    // 编译着色器
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    // 创建程序
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('Failed to link shader program: ' + gl.getProgramInfoLog(this.program));
    }

    // 获取属性和统一变量位置
    this.locations = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
      texture: gl.getUniformLocation(this.program, 'u_texture')
    };
  }

  /**
   * 编译着色器
   */
  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Failed to compile shader: ' + error);
    }

    return shader;
  }

  /**
   * 创建顶点缓冲区
   */
  createVertexBuffer() {
    const gl = this.gl;

    // 定义矩形顶点 (位置和纹理坐标)
    const vertices = new Float32Array([
      // 位置      纹理坐标
      -1, -1,     0, 1,  // 左下
       1, -1,     1, 1,  // 右下
      -1,  1,     0, 0,  // 左上
       1,  1,     1, 0   // 右上
    ]);

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  /**
   * 创建纹理
   */
  createTexture() {
    const gl = this.gl;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    
    // 设置纹理参数
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  /**
   * 渲染视频帧
   */
  renderFrame(imageData, width, height) {
    if (!this.isInitialized) return;

    const gl = this.gl;

    // 设置视口
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    // 清除画布
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 使用着色器程序
    gl.useProgram(this.program);

    // 绑定顶点缓冲区
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    // 设置位置属性
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 16, 0);

    // 设置纹理坐标属性
    gl.enableVertexAttribArray(this.locations.texCoord);
    gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 16, 8);

    // 更新纹理数据
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData);

    // 设置纹理统一变量
    gl.uniform1i(this.locations.texture, 0);

    // 绘制
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * 调整画布大小
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }

  /**
   * 销毁渲染器
   */
  destroy() {
    if (this.gl) {
      if (this.texture) {
        this.gl.deleteTexture(this.texture);
      }
      if (this.vertexBuffer) {
        this.gl.deleteBuffer(this.vertexBuffer);
      }
      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
    }
    this.isInitialized = false;
  }
}