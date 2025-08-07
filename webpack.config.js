const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/main.js',
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
    publicPath: '/'
  },
  
  resolve: {
    fallback: {
      // Node.js polyfills for browser
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer"),
      "process": require.resolve("process/browser"),
      "util": require.resolve("util"),
      "path": require.resolve("path-browserify"),
      "fs": false,
      "os": false,
      "net": false,
      "tls": false
    },
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-transform-runtime']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource'
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource'
      }
    ]
  },
  
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'global': 'globalThis',
    }),
    
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
    
    new HtmlWebpackPlugin({
      template: './index.html',
      inject: 'body'
    })
  ],
  
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
    host: '0.0.0.0',
    hot: true,
    open: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    }
  },
  
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        ffmpeg: {
          test: /[\\/]node_modules[\\/]@ffmpeg[\\/]/,
          name: 'ffmpeg',
          chunks: 'all',
        },
        mp4box: {
          test: /[\\/]node_modules[\\/]mp4box[\\/]/,
          name: 'mp4box',
          chunks: 'all',
        }
      }
    }
  },
  
  devtool: process.env.NODE_ENV === 'development' ? 'eval-source-map' : 'source-map',
  
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000
  }
};