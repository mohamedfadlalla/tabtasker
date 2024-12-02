// webpack.config.js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  mode: 'production',
  entry: {
    background: './src/background.js',
    classifier: './src/classifier.js',
    dataCollector: './src/dataCollector.js',
    graphVisualizer: './src/graphVisualizer.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  resolve: {
    extensions: ['.js'],
    fallback: {
      "path": false,
      "fs": false
    }
  },
  experiments: {
    topLevelAwait: true,
  }
};