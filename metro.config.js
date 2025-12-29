// Polyfill for toReversed method (Node.js < 20 compatibility)
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return this.slice().reverse();
  };
}

const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add SVG support for victory-native
config.resolver.assetExts.push('svg');

module.exports = config;
