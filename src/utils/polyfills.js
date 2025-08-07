/**
 * 浏览器环境polyfills - 修复crypto和Node.js模块兼容性问题
 */

// 修复crypto.getRandomValues问题
if (typeof global === 'undefined') {
  globalThis.global = globalThis;
}

// 确保crypto对象存在并具有getRandomValues方法
if (!globalThis.crypto) {
  globalThis.crypto = {};
}

if (!globalThis.crypto.getRandomValues) {
  globalThis.crypto.getRandomValues = function(array) {
    // 使用Math.random()作为后备方案
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// 修复Buffer问题
if (!globalThis.Buffer) {
  try {
    const { Buffer } = await import('buffer');
    globalThis.Buffer = Buffer;
  } catch (error) {
    console.warn('Buffer polyfill not available');
  }
}

// 修复process问题
if (!globalThis.process) {
  globalThis.process = {
    env: {},
    browser: true,
    version: '',
    versions: {},
    nextTick: (fn) => setTimeout(fn, 0),
    cwd: () => '/',
    platform: 'browser'
  };
}

// 为FFmpeg.wasm修复SharedArrayBuffer检测
if (typeof SharedArrayBuffer === 'undefined') {
  globalThis.SharedArrayBuffer = ArrayBuffer;
  console.warn('SharedArrayBuffer not available, using ArrayBuffer fallback');
}

// WebAssembly优化
if (typeof WebAssembly !== 'undefined') {
  // 确保WebAssembly在工作线程中可用
  if (typeof importScripts !== 'undefined') {
    // 在Worker中
    globalThis.WebAssembly = WebAssembly;
  }
}

// 修复URL构造函数问题
if (!globalThis.URL && typeof URL !== 'undefined') {
  globalThis.URL = URL;
}

// 修复performance对象
if (!globalThis.performance) {
  globalThis.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByName: () => [],
    getEntriesByType: () => []
  };
}

console.log('Browser polyfills loaded successfully');