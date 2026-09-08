const { defineConfig } = require('eslint/config');
const universe = require('eslint-config-universe/flat/native');

module.exports = defineConfig([
  { ignores: ['uniwind-types.d.ts'] },
  ...universe,
  {
    rules: {
      // expo-video's player (from useVideoPlayer) is mutated by design —
      // player.play(), player.currentTime = x, player.muted = true are its
      // real, documented API, not a violation of anything this rule can
      // fix. Same for the headless audio player used the same way.
      'react-hooks/immutability': 'off',
    },
  },
]);
