const path = require('path');
const webpack = require('webpack');

module.exports = {
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  entry: './index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'b-installer.js'
  },
  plugins: [
    new webpack.BannerPlugin({ banner: '#! /usr/bin/env node', raw: true })
  ]
};
