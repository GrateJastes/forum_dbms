const debug = process.env.DEBUG === 'true';

module.exports = {
  mode: debug ? 'development' : 'production',
  entry: path.resolve('src/server.ts'),
  output: {
    path: path.resolve(__dirname, 'src/dist'),
    publicPath: '/',
    filename: 'server_bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /(.*node_modules)/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: debug,
          },
        },
      },
    ],
  },
};
