# Third-Party Notices

This package's native video composition engine (trim, color filters, image/GIF
overlays, audio mixing, transitions, thumbnail/waveform generation) is adapted
from [`pro_video_editor`](https://github.com/hm21/pro_video_editor) by Alex
Frei, licensed under BSD-3-Clause. See `LICENSE` for the full original license
text alongside this package's own.

`pro_video_editor` is a Flutter plugin. Its Dart-facing API and Flutter
plugin-registration glue (`MethodChannel`/`Pigeon`/`EventChannel` boundary
code) do not apply to this package and were not reused — this package
implements its own JS-facing API via the Expo Modules API. The native
iOS (Swift/AVFoundation) and Android (Kotlin/Media3 Transformer) composition
logic underneath that boundary — the actual video-processing implementation —
is what this package adapts.

As the port progresses, this file will track which native source files were
adapted from `pro_video_editor` versus written new for this package, so the
attribution stays accurate and specific rather than a blanket claim over the
whole codebase.

## iOS — adapted from `pro_video_editor`

| This package | `pro_video_editor` source | Notes |
| --- | --- | --- |
| `ios/src/shared/EncodedImage.swift` | `darwin/.../shared/core/models/EncodedImage.swift` | `FlutterStandardTypedData` unwrap removed — Expo Modules API bridges JS binary data to `Data` directly. |
| `ios/src/features/render/models/VideoClip.swift` | `darwin/.../render/models/VideoClip.swift` | Verbatim; doc comments referencing "the platform channel" reworded to "the JS boundary". |
| `ios/src/features/render/models/VideoCompositorConfig.swift` | `darwin/.../render/models/VideoCompositorConfig.swift` | Verbatim, no changes. |
| `ios/src/features/render/models/RenderConfig.swift` | `darwin/.../render/models/RenderConfig.swift` | `#if os(macOS) import FlutterMacOS #else import Flutter #endif` guard removed — unused by the file's actual logic. |
| `ios/src/shared/LoggingConstants.swift` | `darwin/.../shared/core/constants/LoggingConstants.swift` | Verbatim; package tag renamed `ProVideoEditor` → `ExpoProVideoEditor`. |
| `ios/src/shared/PluginLog.swift` | `darwin/.../shared/logging/PluginLog.swift` | Verbatim logic; doc comments referencing "Dart"/"Flutter"/the platform-channel log level reworded for a JS/Expo audience. |
| `ios/src/features/render/helpers/ApplyRotation.swift` | `darwin/.../render/helpers/ApplyRotation.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ApplyFlip.swift` | `darwin/.../render/helpers/ApplyFlip.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ApplyCrop.swift` | `darwin/.../render/helpers/ApplyCrop.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ApplyScale.swift` | `darwin/.../render/helpers/ApplyScale.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ApplyBitrate.swift` | `darwin/.../render/helpers/ApplyBitrate.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ApplyPlaybackSpeed.swift` | `darwin/.../render/helpers/ApplyPlaybackSpeed.swift` | Verbatim, no changes. References `CustomVideoCompositionInstruction`, ported separately. |
| `ios/src/features/render/helpers/ApplyBlur.swift` | `darwin/.../render/helpers/ApplyBlur.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ApplyColorMatrix.swift` | `darwin/.../render/helpers/ApplyColorMatrix.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/MediaInfoExtractor.swift` | `darwin/.../render/helpers/MediaInfoExtractor.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/DecodeOrientedImage.swift` | `darwin/.../render/helpers/DecodeOrientedImage.swift` | Verbatim; one doc comment mentioning "the plugin" reworded to "the module". |
| `ios/src/features/render/helpers/ApplyAnimation.swift` | `darwin/.../render/helpers/ApplyAnimation.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ApplyImageLayer.swift` | `darwin/.../render/helpers/ApplyImageLayer.swift` | Verbatim, no changes. |
| `ios/src/features/render/utils/VideoCompositor.swift` | `darwin/.../render/utils/VideoCompositor.swift` | Verbatim; one doc comment referencing Flutter's `Transform.rotate` reworded to a framework-neutral description of the same clockwise-rotation convention. |
| `ios/src/features/render/helpers/ApplyChromaKey.swift` | `darwin/.../render/helpers/ApplyChromaKey.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ClipTransitionGeometry.swift` | `darwin/.../render/helpers/ClipTransitionGeometry.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ClipTransitionRenderer.swift` | `darwin/.../render/helpers/ClipTransitionRenderer.swift` | Verbatim, no changes. References `ExportSessionDriver`, ported separately. |
| `ios/src/shared/ExportGate.swift` | `darwin/.../shared/concurrency/ExportGate.swift` | Verbatim, no changes. |
| `ios/src/shared/ExportSessionGuard.swift` | `darwin/.../shared/concurrency/ExportSessionGuard.swift` | Verbatim; one doc comment referencing "the plugin" reworded to "the module". |
| `ios/src/shared/ExportWatchdog.swift` | `darwin/.../shared/concurrency/ExportWatchdog.swift` | Verbatim, no changes. |
| `ios/src/shared/ExportSessionDriver.swift` | `darwin/.../shared/concurrency/ExportSessionDriver.swift` | Verbatim; one doc comment referencing "the plugin" reworded to "the module". (Initially missed in the first pass — caught by the compile-check step, see below.) |
| `ios/src/features/render/RenderVideo.swift` | `darwin/.../render/RenderVideo.swift` | Verbatim, no changes — this file already exposes a plain Swift closure API (`onProgress`/`onComplete`/`onError`), with no Flutter dependency at all. The Flutter-specific glue lives one layer up, in `ProVideoEditorPlugin.swift`, which is not being ported (see below). |
| — (not ported) | `darwin/.../shared/core/models/RenderTask.swift` | Deliberately **not** ported. This class exists only to adapt `RenderVideo`'s plain-closure callbacks into Flutter's `FlutterResult`/`FlutterError` method-channel convention. Expo Modules API's `AsyncFunction` (`async throws -> T`) already does this adaptation natively — resolving/rejecting the JS Promise — so this package's own module-glue layer (still to be written) replaces `RenderTask` directly rather than porting a Flutter-shaped wrapper and re-wrapping it again. |
| `ios/src/features/render/utils/VideoMimeUtils.swift` | `darwin/.../render/utils/VideoMimeUtils.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/BitrateCapPolicy.swift` | `darwin/.../render/helpers/BitrateCapPolicy.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/TrackEndTrimmer.swift` | `darwin/.../render/helpers/TrackEndTrimmer.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/VideoTranscoder.swift` | `darwin/.../render/helpers/VideoTranscoder.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/BitrateCappedExporter.swift` | `darwin/.../render/helpers/BitrateCappedExporter.swift` | Verbatim; internal `DispatchQueue` labels renamed from `ch.waio.pro_video_editor.*` to `dev.expo.provideoeditor.*` (cosmetic — queue labels are diagnostic strings only, not a functional dependency). |
| `ios/src/features/render/helpers/AudioSequenceBuilder.swift` | `darwin/.../render/helpers/AudioSequenceBuilder.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/AudioPreRenderer.swift` | `darwin/.../render/helpers/AudioPreRenderer.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/AudioReverser.swift` | `darwin/.../render/helpers/AudioReverser.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/VideoSequenceBuilder.swift` | `darwin/.../render/helpers/VideoSequenceBuilder.swift` | Verbatim, no changes. Also carries `VideoCompositionData`, `LayerPlacement`, and `CustomVideoCompositionInstruction`, which live in this same source file upstream. |
| `ios/src/features/render/helpers/CompositionBuilder.swift` | `darwin/.../render/helpers/CompositionBuilder.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/ApplyComposition.swift` | `darwin/.../render/helpers/ApplyComposition.swift` | Verbatim, no changes. |
| `ios/src/features/render/helpers/LayeredCompositionBuilder.swift` | `darwin/.../render/helpers/LayeredCompositionBuilder.swift` | Verbatim, no changes. |

## iOS port status

All 37 native source files that `RenderVideo.render(...)` transitively depends
on have been ported (models, the full composition pipeline — single-track and
layered — every effect helper, transitions, audio pre-render/reverse/mix, the
bitrate-capped exporter, and the concurrency/export-safety layer). None of
them had any real Flutter dependency once traced past their imports — the only
two that did (`EncodedImage`'s byte-unwrap, and `RenderTask`, not ported at
all) are noted above.

**Verified**: the full set compiles cleanly as the `ExpoProVideoEditor` pod
target (`xcodebuild ... -scheme ExpoProVideoEditor -sdk iphonesimulator build`
→ `BUILD SUCCEEDED`) against the example app. Nothing is wired up to JS yet —
this only confirms the native composition engine itself is complete and
self-consistent.

## iOS module glue (JS-callable)

`ExpoProVideoEditorModule.swift` now exposes `render(config, id)` and
`cancelRender(id)` as `AsyncFunction`s, plus an `onRenderProgress` event —
the Expo Modules API equivalent of what `ProVideoEditorPlugin.swift`'s
`renderVideo`/`cancelTask` method-channel handlers and `RenderTask` did for
Flutter. Not a line-for-line port (there's no Flutter plugin file to adapt
here): `AsyncFunction`'s `Promise` argument replaces `RenderTask`'s manual
`FlutterResult` storage/dedup, and `Module.sendEvent` replaces the
`FlutterEventChannel`/`StreamHandler` progress-streaming plumbing — both
handled natively by Expo instead.

The render config crosses the JS boundary as a **raw dictionary** (`[String:
Any]` on the Swift side, a plain object in TS — see `src/ExpoProVideoEditor.types.ts`),
handed straight to the already-ported `RenderConfig.fromArguments(_:)`
unchanged, rather than re-modeling `RenderConfig`'s large/deeply-nested shape
as a second parallel tree of Expo `Record` structs.

**Verified**: compiles clean as part of the same `ExpoProVideoEditor` pod
target build; `tsc --noEmit` and `eslint` both clean on the TS side. Nothing
has been exercised at runtime yet (no example-app screen calls `render` yet).

## Remaining work

Android (Kotlin/Media3 Transformer) has not been started. The TS-facing API
surface for anything beyond trim/basic effects (filters, image/text overlays,
audio mixing, transitions) is modeled in `RenderConfig` already but untested
end-to-end.
Then the equivalent Android port (Kotlin/Media3 Transformer), and the shared
TypeScript API surface in `src/`.
