const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add SVG support for victory-native
config.resolver.assetExts.push('svg');

module.exports = config;
