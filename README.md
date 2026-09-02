# expo-pro-video-editor

A native video composition module for Expo/React Native — trim, crop, color
filters, image/GIF/text overlays, and multi-track audio mixing, exported to a
single video file.

Built on the same native frameworks as any serious video editor: iOS uses
`AVFoundation`/`AVMutableComposition` + `CoreImage`, Android uses
`androidx.media3.transformer` + `MediaCodec`/`MediaMuxer`. No FFmpeg
dependency (FFmpegKit, the library most RN video-processing packages relied
on, was retired in 2025/2026), no paid SDK, no license fee.

## Origin

The native composition logic is adapted from
[`pro_video_editor`](https://github.com/hm21/pro_video_editor), a Flutter
plugin by Alex Frei that does the same job for Flutter apps via a
`MethodChannel` bridge. Flutter and Expo/React Native don't share a plugin
protocol, so that bridging layer can't be reused directly — but the actual
video-processing code underneath it (AVFoundation compositions on iOS, Media3
Transformer on Android) is plain native code that doesn't know or care which
JS framework called it. This package keeps that native logic and replaces
only the bridge with the Expo Modules API.

See `LICENSE` and `NOTICE.md` for the full attribution — this is a BSD-3-Clause
derivative work.

## Status

Early, in-progress port. Not yet published to npm. Track progress against
`pro_video_editor`'s feature set in `NOTICE.md`.

## Development

This repo is a standard Expo native module layout:

```
src/       TypeScript API surface (what consumers import)
ios/       Swift native implementation
android/   Kotlin native implementation
example/   A runnable Expo app for testing the module in isolation
```

### Running the example app

```sh
bun install
cd example
bun install
bun ios      # or: bun android
```

`example/` autolinks this module from `..` (see `example/package.json`'s
`expo.autolinking.nativeModulesDir`), so changes to `src/`, `ios/`, or
`android/` are picked up without publishing anything.

Beyond testing individual native features, `example/` also doubles as a
staging ground for the actual clip-editor screen UI (trim scrubber, filter
tray, text/sticker tool, audio picker) being built against the Shop Society
Figma designs — proving the screen and the native module out together here,
independent of `shop-society-mobile`'s app shell, before porting the finished
screen over.

### Scripts

- `bun run build` — compile `src/` to `build/`
- `bun run lint` — lint `src/`
- `bun run test` — run tests
- `bun run open:ios` / `bun run open:android` — open the example app's native
  project in Xcode / Android Studio
