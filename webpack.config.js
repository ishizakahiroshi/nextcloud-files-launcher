const path = require('node:path')

module.exports = {
  entry: { main: './js/src/main.js', fixture: { import: './tests/fixture-source.js', filename: '../tests/fixture.js' } },
  output: { path: path.resolve(__dirname, 'js'), filename: '[name].js', iife: true },
  resolve: { extensions: ['.js'], fallback: { string_decoder: false, stream: false } },
  devtool: false,
}
