/**
 * 极简polyfills - 只修复最关键的兼容性问题
 */

// 确保crypto.getRandomValues存在
(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  // 修复global
  if (!window.global) {
    window.global = window;
  }
  
  // 修复crypto
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
  
  // 修复process
  if (!window.process) {
    window.process = {
      env: {},
      browser: true,
      nextTick: function(fn) { setTimeout(fn, 0); }
    };
  }
  
  // SharedArrayBuffer后备
  if (typeof SharedArrayBuffer === 'undefined') {
    window.SharedArrayBuffer = ArrayBuffer;
  }
  
  console.log('Simple polyfills loaded');
})();