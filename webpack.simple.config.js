const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';
  
  return {
    entry: './src/simple-main.js',
    
    output: {
      path: path.resolve(__dirname, 'dist-simple'),
      filename: isDev ? '[name].js' : '[name].[contenthash].js',
      clean: true,
      publicPath: '/'
    },
    
    mode: argv.mode || 'development',
    
    devServer: {
      port: 9001,
      host: '0.0.0.0',
      hot: true,
      open: true,
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin'
      },
      static: {
        directory: path.join(__dirname, 'dist-simple'),
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
              presets: ['@babel/preset-env']
            }
          }
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader']
        }
      ]
    },
    
    plugins: [
      new HtmlWebpackPlugin({
        template: './index.html',
        filename: 'index.html',
        inject: 'body',
        minify: isDev ? false : {
          removeComments: true,
          collapseWhitespace: true,
          removeRedundantAttributes: true
        }
      })
    ],
    
    devtool: isDev ? 'eval-source-map' : 'source-map',
    
    performance: {
      hints: isDev ? false : 'warning',
      maxAssetSize: 1024000,
      maxEntrypointSize: 1024000
    }
  };
};