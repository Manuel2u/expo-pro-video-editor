# expo-pro-video-editor

Native video composition for Expo/React Native — trim, crop, color filters,
image/GIF/text overlays, and multi-track audio mixing, exported to a single
video file. Ships with a set of themable React Native UI components
(waveforms, trim scrubbers, a voice recorder) for building an editor or
audio-recording UI on top of it.

iOS uses `AVFoundation`/`AVMutableComposition` + `CoreImage`; Android uses
`androidx.media3.transformer` + `MediaCodec`/`MediaMuxer`. No FFmpeg
dependency, no paid SDK, no license fee.

## Status

Early, in-progress port, not yet published to npm — see [Origin](#origin) and
`NOTICE.md` for what's ported so far. This README is the interim reference
while the package is pre-release; a full documentation site is planned once
it's published.

## Table of contents

- [Installation](#installation)
- [Usage](#usage)
- [Components](#components)
  - [AudioWaveform](#audiowaveform)
  - [AudioTrimScrubber](#audiotrimscrubber)
  - [TrimScrubber](#trimscrubber)
  - [RecordingIndicator](#recordingindicator)
  - [VoiceRecorder](#voicerecorder)
- [Theming](#theming)
- [Native module reference](#native-module-reference)
- [Origin](#origin)
- [Development](#development)
- [Contributors](#contributors)

## Installation

```sh
npx expo install expo-pro-video-editor
```

The native module (`render`, `cancelRender`, `extractWaveform`) needs nothing
beyond `expo`/`react`/`react-native`, which every Expo app already has. If
that's all you're using, skip ahead to the [native module
reference](#native-module-reference).

The UI components pull in their own peers depending on which ones you use:

| Using                                   | Also install                                          |
| ---------------------------------------- | ------------------------------------------------------ |
| `AudioWaveform`, `AudioTrimScrubber`     | `uniwind`, `tailwindcss`                                |
| `TrimScrubber`                           | the above, plus `expo-video`, `expo-image`              |
| `VoiceRecorder`, `RecordingIndicator`    | the above, plus `expo-audio`                            |

```sh
npx expo install uniwind tailwindcss expo-video expo-image expo-audio react-native-svg
```

Then wire up Uniwind so your Metro/Tailwind pipeline can style these
components — skip this if your app already uses Uniwind for its own UI.

**`metro.config.js`:**

```js
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
});
```

**`global.css`:**

```css
@import 'tailwindcss';
@import 'uniwind';
@import 'expo-pro-video-editor/theme.css';
@source '../node_modules/expo-pro-video-editor/src';

@source './app';
@source './components';
```

The `@source` glob is what lets Tailwind see the classes used inside this
package's own component source and generate the matching CSS for them —
without it, the components render unstyled.

**Import `global.css` once, at your app's root** (e.g. `app/_layout.tsx`):

```ts
import '../global.css';
```

No provider component, no context, no other runtime setup — import a
component and use it.

## Usage

```ts
import { AudioWaveform, VoiceRecorder, extractWaveform } from 'expo-pro-video-editor';

// A completed recording's waveform
<AudioWaveform
  inputPath={fileUri}
  width={320}
  currentTime={playbackPositionSeconds}
  startSeconds={0}
  endSeconds={clipDurationSeconds}
/>

// Recording a new one
<VoiceRecorder
  visible={isRecorderOpen}
  width={320}
  onCancel={() => setRecorderOpen(false)}
  onConfirm={(result) => sendVoiceMessage(result.uri, result.durationSeconds)}
/>

// Or just the raw peak data, for your own bar rendering
const peaks = await extractWaveform(fileUri, 40);
```

## Components

### AudioWaveform

A peak-amplitude waveform for a **completed** audio or video file — bars
mirror the standard voice-note look (Voice Memos, WhatsApp), with the
already-played portion turning solid while the rest stays dim. Use this for a
chat bubble's voice message, or an editor's "here's the clip's own embedded
audio" row.

```ts
import { AudioWaveform } from 'expo-pro-video-editor';

<AudioWaveform
  inputPath={fileUri}
  width={320}
  currentTime={playbackPositionSeconds}
  startSeconds={0}
  endSeconds={clipDurationSeconds}
  onDelete={() => removeThisTrack()} // optional — omit for a read-only display
/>
```

| Prop           | Type         | Required | Notes                                                                      |
| -------------- | ------------ | -------- | ---------------------------------------------------------------------------- |
| `inputPath`    | `string`     | yes      | Passed straight to `extractWaveform` internally.                             |
| `width`        | `number`     | yes      |                                                                              |
| `currentTime`  | `number`     | yes      | Seconds — bars before this point (within `startSeconds`/`endSeconds`) render as played. |
| `startSeconds` | `number`     | yes      | Start of the played-fraction window.                                        |
| `endSeconds`   | `number`     | yes      | End of the played-fraction window.                                          |
| `onDelete`     | `() => void` | no       | Shows a delete (✕) button when provided; omit for a read-only display.       |
| `barCount`     | `number`     | no       | Defaults to `90`.                                                            |

A file with no audio track renders as `null` rather than an empty strip; a
real extraction failure renders a "Couldn't load audio waveform" message.

### AudioTrimScrubber

Trim UI for a **standalone audio file** (music, a picked file, a voice-over
recording) — a waveform with two drag handles marking the selected window.
Long tracks scroll horizontally; short tracks fit without scrolling.

```ts
import { AudioTrimScrubber } from 'expo-pro-video-editor';

<AudioTrimScrubber
  inputPath={audioTrack.path}
  durationSeconds={audioTrack.durationSeconds}
  startSeconds={trimRange.startSeconds}
  endSeconds={trimRange.endSeconds}
  currentTime={isPlayingThisTrack ? currentTime : null}
  onChange={setTrimRange}
  onDelete={() => setAudioTrack(null)}
  width={320}
/>
```

| Prop              | Type                                                             | Required | Notes                                                                    |
| ----------------- | ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| `inputPath`       | `string`                                                            | yes      |                                                                              |
| `durationSeconds` | `number`                                                            | yes      | The file's full duration, not the trimmed window.                           |
| `startSeconds`    | `number`                                                            | yes      | Current trim start.                                                         |
| `endSeconds`      | `number`                                                            | yes      | Current trim end.                                                           |
| `currentTime`     | `number \| null`                                                    | yes      | This file's own playback position, or `null` while not playing it — bars fall back to the unplayed shade when `null`. |
| `onChange`        | `(range: { startSeconds: number; endSeconds: number }) => void`    | yes      | Called continuously while dragging either handle.                           |
| `onDelete`        | `() => void`                                                        | no       | Shows a delete (✕) button when provided.                                    |
| `width`           | `number`                                                            | yes      |                                                                              |

### TrimScrubber

The merged video timeline bar: a continuous filmstrip built from one or more
clips (proportioned by duration), with two drag handles constraining the
overall trimmed window against the full merged duration. Requires
`expo-video` and `expo-image`.

```ts
import { TrimScrubber, type TimelineClip } from 'expo-pro-video-editor';

const clips: TimelineClip[] = [{ uri: videoUri, durationSeconds: 12.4 }];
// a multi-clip timeline is just a longer array, in playback order

<TrimScrubber
  clips={clips}
  startSeconds={trimRange.startSeconds}
  endSeconds={trimRange.endSeconds}
  onChange={setTrimRange}
  width={320}
/>
```

| Prop           | Type                                                              | Required | Notes                                                 |
| -------------- | -------------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| `clips`        | `TimelineClip[]` (`{ uri: string; durationSeconds: number }[]`)      | yes      | A single-clip trim UI is just a one-element array.        |
| `startSeconds` | `number`                                                              | yes      | Against the clips' combined total duration.                |
| `endSeconds`   | `number`                                                              | yes      |                                                            |
| `onChange`     | `(range: { startSeconds: number; endSeconds: number }) => void`      | yes      |                                                            |
| `width`        | `number`                                                              | yes      |                                                            |

### RecordingIndicator

The live progress indicator shown while recording — used internally by
`VoiceRecorder`, and exported standalone for building your own recorder UI.
Two modes:

**`mode: 'filmstrip'`** — a video's own frames with a moving playhead, so the
user can see the end of a fixed-length clip coming. Requires `expo-video` and
`expo-image`.

```ts
import { RecordingIndicator } from 'expo-pro-video-editor';

<RecordingIndicator
  mode="filmstrip"
  uri={videoUri}
  durationSeconds={videoDurationSeconds}
  currentTime={videoCurrentTime}
  width={320}
/>
```

**`mode: 'waveform'`** — a live mic-amplitude bar graph, for recording
contexts with no video (e.g. a chat voice message). Requires `expo-audio`'s
metering data.

```ts
import { RecordingIndicator } from 'expo-pro-video-editor';
import { useAudioRecorderState } from 'expo-audio';

const state = useAudioRecorderState(recorder, 100);

<RecordingIndicator
  mode="waveform"
  metering={state.metering}
  isRecording={state.isRecording}
  width={320}
/>
```

`metering` only populates if the recorder's options include
`isMeteringEnabled: true` — `VoiceRecorder` wires this automatically.

| Prop (filmstrip mode) | Type              | Required |
| ------------------------ | ------------------ | -------- |
| `uri`                    | `string \| null`   | yes      |
| `durationSeconds`        | `number`           | yes      |
| `currentTime`            | `number`           | yes      |
| `width`                  | `number`           | yes      |

| Prop (waveform mode) | Type                  | Required |
| ----------------------- | --------------------- | -------- |
| `metering`              | `number \| undefined` | yes      |
| `isRecording`           | `boolean`              | yes      |
| `width`                 | `number`               | yes      |

### VoiceRecorder

A full record → stop → discard → done flow, presented as a bottom sheet.
Requires `expo-audio`.

It has no opinion on video or sheet libraries — no video player of its own,
and no dependency on any particular bottom-sheet package. Both are wired in
via props:

- Pass `progress` if you have a video playing behind the sheet (e.g. an
  editor narrating over a clip) — this drives `RecordingIndicator` in
  filmstrip mode and auto-stops the take once the video reaches its end. Omit
  it for a plain live-amplitude waveform with no fixed end (e.g. a chat app).
- Pass `Container` to present in a real bottom sheet (`@gorhom/bottom-sheet`,
  `@niibase/bottom-sheet-manager`, or your own) instead of the default plain
  `Modal`.

**No video, default `Modal` (a chat app):**

```ts
import { VoiceRecorder } from 'expo-pro-video-editor';

<VoiceRecorder
  visible={isRecorderOpen}
  width={320}
  onCancel={() => setRecorderOpen(false)}
  onConfirm={(result) => {
    // result: { uri: string; durationSeconds: number }
    sendVoiceMessage(result.uri, result.durationSeconds);
    setRecorderOpen(false);
  }}
/>
```

**With a video playing behind it (an editor):**

```ts
<VoiceRecorder
  visible={isVoiceRecorderOpen}
  width={320}
  backgroundContent={<MyVideoPreview />}
  progress={{
    videoUri: previewUri,
    currentTime: player.currentTime,
    totalDuration: videoDurationSeconds,
    onPlaybackRequest: (action) => {
      if (action === 'play') player.play();
      else if (action === 'pause') player.pause();
      else player.currentTime = 0; // 'restart'
    },
  }}
  onCancel={() => setVoiceRecorderOpen(false)}
  onConfirm={(result) => setAudioTrack({ path: result.uri, durationSeconds: result.durationSeconds })}
/>
```

**With a real bottom sheet instead of `Modal`:**

```ts
<VoiceRecorder
  visible={isRecorderOpen}
  width={320}
  Container={({ visible, onRequestClose, children }) => (
    <MyBottomSheetLibrary visible={visible} onDismiss={onRequestClose}>
      {children}
    </MyBottomSheetLibrary>
  )}
  onCancel={() => setRecorderOpen(false)}
  onConfirm={(result) => { /* ... */ }}
/>
```

| Prop                | Type                                                           | Required | Notes                                                                        |
| ------------------- | ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------- |
| `visible`           | `boolean`                                                            | yes      |                                                                                     |
| `onCancel`          | `() => void`                                                         | yes      |                                                                                     |
| `onConfirm`         | `(result: { uri: string; durationSeconds: number }) => void`        | yes      | Called when the user taps Done.                                                    |
| `title`             | `string`                                                             | no       | Defaults to `"Voice-over"`.                                                        |
| `width`             | `number`                                                             | yes      |                                                                                     |
| `backgroundContent` | `ReactNode`                                                          | no       | Rendered behind the sheet's own content — e.g. your video preview.                 |
| `progress`          | `{ videoUri, currentTime, totalDuration, onPlaybackRequest }`        | no       | See above. Omit for a plain live-amplitude waveform with no fixed end.            |
| `Container`         | `ComponentType<{ visible, onRequestClose, children }>`               | no       | Defaults to a plain `Modal`. Pass your own sheet component to use it instead.      |

`progress.onPlaybackRequest` fires with `'play'`, `'pause'`, or `'restart'` at
the points where `VoiceRecorder` needs your video to react (start recording →
play, stop/sheet-close → pause, sheet-open/discard → restart from the
beginning). It has no player of its own — this callback is how it drives
yours.

Other behavior worth knowing:

- Requests microphone permission and configures the audio session
  automatically when the sheet opens; shows an inline error if denied.
- Once a take is stopped, the record button stays disabled until the user
  explicitly discards (✕) or confirms (Done) — re-recording never silently
  replaces an existing take.
- With `progress` set, the take auto-stops when the video reaches its end.

## Theming

Every color is a CSS custom property, defined with a default in
`expo-pro-video-editor/theme.css`. Override any of them in your own
`global.css`, after importing this package's theme:

```css
@import 'expo-pro-video-editor/theme.css';

@layer theme {
  :root {
    @variant light {
      --color-video-editor-accent: #6366f1; /* your brand color instead of the default pink */
    }
    @variant dark {
      --color-video-editor-accent: #818cf8;
    }
  }
}
```

| Token                                | Used for                                                              | Default (light) |
| -------------------------------------- | ------------------------------------------------------------------------ | ----------------- |
| `--color-video-editor-accent`          | Trim handles/border (`TrimScrubber`), record/done buttons                | `#fe7395`          |
| `--color-video-editor-accent-light`    | Custom-audio trim handles/border (`AudioTrimScrubber`) — kept visually distinct from the video's own trim accent | `#ffc2d3` |
| `--color-video-editor-surface`         | Waveform/filmstrip track background                                      | `#f2f1f1`          |
| `--color-video-editor-bar-played`      | `AudioWaveform`'s played bars                                             | `#fe7395`          |
| `--color-video-editor-bar-unplayed`    | Unplayed bars across all waveform components                             | `#9ca3af`          |
| `--color-video-editor-border`          | Thin borders (delete button, record button ring)                         | `#e0e2e6`          |
| `--color-video-editor-text`            | Primary text                                                              | `#000000`          |
| `--color-video-editor-text-muted`      | Secondary/error text                                                      | `#9e9b9b`          |
| `--color-video-editor-recording`       | `RecordingIndicator`'s live progress overlay/playhead/bars — deliberately distinct from `accent` so an active recording reads as its own state | `#2dd4bf` |

Each token has separate `light`/`dark` values, both already set to sensible
defaults — overriding is entirely optional.

## Native module reference

```ts
import ExpoProVideoEditor, { render, cancelRender, extractWaveform } from 'expo-pro-video-editor';
```

`render`, `cancelRender`, and `extractWaveform` are available both as named
exports (destructure whichever you need) and as methods on the default export
(`ExpoProVideoEditor.render(...)`) — same functions either way.

### `render(config, id)`

```ts
render(config: RenderConfig, id: string): Promise<Uint8Array | null>
```

Renders `config` to a single video file. `id` is a caller-chosen string used
to correlate progress events and cancellation with this specific render — use
a UUID or similar if more than one render might be in flight at once.

- Resolves with the output as raw `Uint8Array` bytes when `config.outputPath`
  is omitted.
- Resolves with `null` when `config.outputPath` is set (the file is written
  directly to that path instead).
- Rejects with a `CANCELED` error if `cancelRender(id)` is called (or the
  pipeline cancels itself, e.g. a stalled-export watchdog) before it
  finishes.
- Rejects with `RENDER_ERROR` on any other failure.

Progress is reported via the `onRenderProgress` event, keyed by the same `id`:

```ts
const subscription = ExpoProVideoEditor.addListener('onRenderProgress', (event) => {
  // event: { id: string; progress: number } — progress is 0...1
  if (event.id === myRenderId) setProgress(event.progress);
});

// later
subscription.remove();
```

### `cancelRender(id)`

```ts
cancelRender(id: string): Promise<null>
```

Cancels the render started with `render(config, id)`, if it's still running.
The corresponding `render()` call rejects with a `CANCELED` error.

### `extractWaveform(inputPath, bucketCount)`

```ts
extractWaveform(inputPath: string, bucketCount: number): Promise<number[]>
```

Extracts a waveform from the first audio track of `inputPath` (a video or
audio file), downsampled to `bucketCount` peak-amplitude values in the
`0...1` range, evenly spanning the file's full duration.

- Rejects with `INVALID_ARGUMENTS` if `bucketCount` is not positive.
- Rejects with `WAVEFORM_ERROR` if the file has no audio track or cannot be
  read. Check for the substring `"No audio track found"` in the error
  message to distinguish "genuinely silent file" from "real read error" —
  this is exactly what `AudioWaveform` does internally.

The raw values are not contrast-adjusted or auto-gained — pass them through
`normalizeWaveformPeaks` before rendering your own bars with them:

```ts
import { extractWaveform, normalizeWaveformPeaks } from 'expo-pro-video-editor';

const rawPeaks = await extractWaveform(fileUri, 40);
const peaks = normalizeWaveformPeaks(rawPeaks); // 0...1, contrast-adjusted
```

`AudioWaveform`/`AudioTrimScrubber` already do this internally — you only
need `normalizeWaveformPeaks` yourself if you're rendering your own bars
(e.g. a chat app with its own bubble styling) and just want correctly-scaled
data. `contrastExponent` (second argument, default `1.6`) raises quiet bars
down further relative to loud ones for a spikier look; lower it to flatten
the curve back toward the raw linear values.

### `RenderConfig`

```ts
interface RenderConfig {
  videoClips: VideoClip[];
  outputFormat?: 'mp4' | 'mov';
  outputPath?: string; // absolute path to write to; omitted resolves to raw bytes
  rotateTurns?: number; // 90° clockwise rotations (0-3), negative allowed
  flipX?: boolean;
  flipY?: boolean;
  cropWidth?: number;
  cropHeight?: number;
  cropX?: number;
  cropY?: number;
  scaleX?: number;
  scaleY?: number;
  outputWidth?: number; // exact output canvas size; composed frame is letterboxed into it
  outputHeight?: number;
  bitrate?: number; // bits per second
  maxFrameRate?: number;
  enableAudio?: boolean;
  trimToCommonTrackEnd?: boolean;
  playbackSpeed?: number;
  colorFilters?: ColorFilter[];
  audioTracks?: AudioTrack[];
  imageLayers?: ImageLayer[];
  blur?: number; // Gaussian blur radius; 0 or omitted disables it
  chromaKey?: ChromaKey;
  startUs?: number; // global trim of the final composition, in microseconds
  endUs?: number;
  shouldOptimizeForNetworkUse?: boolean;
  imageBytesWithCropping?: boolean;
}

interface VideoClip {
  inputPath: string;
  startUs?: number; // trim window within the source, in microseconds
  endUs?: number;
  volume?: number; // 0...1+, original volume when omitted
  playbackSpeed?: number; // e.g. 2.0 = double speed, 0.5 = half speed
  reverseVideo?: boolean;
  transition?: ClipTransition;
  chromaKey?: ChromaKey;
}

interface AudioTrack {
  path: string;
  volume?: number;
  loop?: boolean;
  audioStartUs?: number; // trim window within the audio file, in microseconds
  audioEndUs?: number;
  startUs?: number; // where on the composition timeline this track plays, in microseconds
  endUs?: number;
}

interface ImageLayer {
  imagePath?: string;
  imageData?: Uint8Array;
  startUs?: number; // -1 (or omitted) = from the start of the video
  endUs?: number; // -1 (or omitted) = until the end of the video
  x?: number; // pixel position; omitted on both axes stretches to the frame
  y?: number;
  width?: number;
  height?: number;
  rotation?: number; // clockwise, in radians
  loop?: boolean;
  animations?: LayerAnimation[];
}

interface ColorFilter {
  matrix: number[]; // 4x5 RGBA + offset transformation matrix, 20 values
  startUs?: number;
  endUs?: number;
}

interface ChromaKey {
  keyColor: number; // screen color to remove, as 0xRRGGBB (or 0xAARRGGBB)
  similarity?: number;
  smoothness?: number;
  spill?: number;
  bgColor?: number; // solid background color (0xAARRGGBB) filling the keyed area
  bgImagePath?: string;
  bgImageData?: Uint8Array;
}

interface ClipTransition {
  type: 'dissolve' | 'fadeToBlack' | 'fadeToWhite' | 'slide' | 'push' | 'wipe';
  durationUs: number;
  curve?: EasingCurve;
  direction?: 'left' | 'right' | 'up' | 'down'; // only meaningful for slide/push/wipe
}

interface LayerAnimation {
  type: 'fade' | 'slide' | 'scale';
  phase: 'animateIn' | 'animateOut' | 'animateInOut';
  durationUs: number;
  curve?: EasingCurve;
  slideDirection?: 'left' | 'right' | 'top' | 'bottom';
  scaleFrom?: number;
}

type EasingCurve =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'bounceIn' | 'bounceOut' | 'bounceInOut'
  | 'elasticIn' | 'elasticOut' | 'elasticInOut';
```

A minimal render — trim one clip to its first 3 seconds and export to a file:

```ts
import { render } from 'expo-pro-video-editor';

await render(
  {
    videoClips: [{ inputPath: sourceUri, startUs: 0, endUs: 3_000_000 }],
    outputPath: destinationUri,
  },
  'render-1'
);
```

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

## Development

This repo is a standard Expo native module layout:

```
src/       TypeScript API surface (what consumers import)
  ui/      Exported React Native UI components
ios/       Swift native implementation
android/   Kotlin native implementation
example/   A runnable Expo app for testing the module in isolation
theme.css  Default design tokens for the UI components
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

Beyond testing individual native features, `example/` also has a full
clip-editor screen (trim scrubber, filter tray, audio picker) built from the
exported UI components, so the components and the native module are proven
out together in one place.

### Scripts

- `bun run build` — compile `src/` to `build/`
- `bun run lint` — lint `src/`
- `bun run test` — run tests
- `bun run open:ios` / `bun run open:android` — open the example app's native
  project in Xcode / Android Studio

## Contributors

Thank you to everyone who has shipped something here.

<p align="center">
  <a href="https://github.com/Manuel2u/expo-pro-video-editor/graphs/contributors">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/contributors/Manuel2u/expo-pro-video-editor.svg?title=false&preset=transparent&border=false&mode=dark" />
      <img alt="expo-pro-video-editor contributors" src="https://shieldcn.dev/contributors/Manuel2u/expo-pro-video-editor.svg?title=false&preset=transparent&border=false&mode=light" />
    </picture>
  </a>
</p>
