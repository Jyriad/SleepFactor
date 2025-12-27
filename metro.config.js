const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add SVG support for victory-native
config.resolver.assetExts.push('svg');
config.resolver.sourceExts.push('svg');

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');

module.exports = config;
