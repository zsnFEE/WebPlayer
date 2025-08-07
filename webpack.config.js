const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const FFmpegFixPlugin = require('./webpack.ffmpeg-fix');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';
  
  return {
    mode: argv.mode || 'development',
    entry: './src/main.js',
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isDev ? '[name].js' : '[name].[contenthash].js',
      clean: true,
      publicPath: '/'
    },
    
    resolve: {
      fallback: {
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        buffer: 'buffer',
        process: 'process/browser',
        util: 'util',
        path: 'path-browserify',
        fs: false,
        os: false
      },
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    
    externals: {
      'fs': 'empty',
      'path': 'empty',
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader'
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif|woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource'
        },
        {
          test: /\.wasm$/,
          type: 'asset/resource'
        }
      ]
    },
    
    ignoreWarnings: [
      {
        module: /node_modules\/@ffmpeg\/ffmpeg/,
        message: /Critical dependency/,
      },
      {
        module: /node_modules\/@ffmpeg\/util/,
        message: /Critical dependency/,
      }
    ],
    
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(argv.mode || 'development'),
        global: 'globalThis'
      }),
      
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser'
      }),
      
      new HtmlWebpackPlugin({
        template: './index.html',
        inject: 'body',
        minify: !isDev
      }),
      
      new FFmpegFixPlugin()
    ],
    
    devServer: {
      static: path.join(__dirname, 'dist'),
      compress: true,
      port: 9000,
      host: '0.0.0.0',
      hot: true,
      open: true,
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin'
      }
    },
    
    optimization: {
      splitChunks: {
        chunks: 'all',
        maxSize: 1024000,
        cacheGroups: {
          ffmpeg: {
            test: /[\\/]node_modules[\\/]@ffmpeg[\\/]/,
            name: 'ffmpeg',
            priority: 30,
            chunks: 'all',
            enforce: true
          },
          mp4box: {
            test: /[\\/]node_modules[\\/]mp4box[\\/]/,
            name: 'mp4box',
            priority: 25,
            chunks: 'all',
            enforce: true
          },
          vendor: {
            test: /[\\/]node_modules[\\/](?!@ffmpeg)(?!mp4box)/,
            name: 'vendors',
            priority: 10,
            chunks: 'all'
          }
        }
      }
    },
    
    devtool: isDev ? 'eval-source-map' : 'source-map',
    
    performance: {
      hints: isDev ? false : 'warning',
      maxEntrypointSize: 1024000,
      maxAssetSize: 1024000
    }
  };
};