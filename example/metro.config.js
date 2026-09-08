// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// npm v7+ will install these under ../node_modules too, since the package
// at .. declares them as peerDependencies. Two copies of a package with
// native view managers (expo-video, expo-audio, expo-image) both getting
// bundled causes "Tried to register two views with the same name" at
// runtime — block the parent copy so everything resolves to this app's own
// ./node_modules copy, the same fix already applied to react/react-native.
config.resolver.blockList = [
  ...Array.from(config.resolver.blockList ?? []),
  // On windows the path will resolve with `\`. We need to escape it with `\\` for the RegExp.
  ...['react', 'react-native', 'expo-video', 'expo-audio', 'expo-image'].map(
    (pkg) => new RegExp(path.resolve('..', 'node_modules', pkg).replace(/\\/g, '\\\\'))
  ),
];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, './node_modules'),
  path.resolve(__dirname, '../node_modules'),
];

config.resolver.extraNodeModules = {
  'expo-pro-video-editor': '..',
};

config.watchFolders = [path.resolve(__dirname, '..')];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// react-native-svg-transformer: lets `import Icon from './icon.svg'` resolve
// to an SVG React component instead of an (unsupported) raw asset require.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});
