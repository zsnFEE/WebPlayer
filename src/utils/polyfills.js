/**
 * 浏览器环境polyfills - 修复crypto和Node.js模块兼容性问题
 */

// 修复global对象
if (typeof global === 'undefined') {
  window.global = window;
  globalThis.global = globalThis;
}

// 修复crypto.getRandomValues问题
if (!window.crypto) {
  window.crypto = {};
}

if (!window.crypto.getRandomValues) {
  window.crypto.getRandomValues = function(array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// 修复process对象
if (!window.process) {
  window.process = {
    env: {},
    browser: true,
    version: '',
    versions: {},
    nextTick: (fn) => setTimeout(fn, 0),
    cwd: () => '/',
    platform: 'browser'
  };
}

// 修复performance对象
if (!window.performance) {
  window.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByName: () => [],
    getEntriesByType: () => []
  };
}

// SharedArrayBuffer检测和后备
if (typeof SharedArrayBuffer === 'undefined') {
  window.SharedArrayBuffer = ArrayBuffer;
  console.warn('SharedArrayBuffer not available, using ArrayBuffer fallback');
}

console.log('Browser polyfills loaded successfully');