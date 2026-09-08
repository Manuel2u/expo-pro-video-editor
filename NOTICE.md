# Third-Party Notices

This package's native video composition engine (trim, color filters, image/GIF
overlays, audio mixing, transitions, thumbnail generation) is adapted from
[`pro_video_editor`](https://github.com/hm21/pro_video_editor) by Alex Frei,
licensed under BSD-3-Clause. See `LICENSE` for the full original license text
alongside this package's own. Waveform extraction (`extractWaveform`) is this
package's own implementation — see "Written new for this package" below.

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
target build; `tsc --noEmit` and `eslint` both clean on the TS side.

**Verified at runtime** on the iOS simulator via the example app's smoke-test
screen: download a small public clip to a local file, `render()` a 3-second
trim, resolve real output bytes (~1.9MB from a 5s/1.1MB source). This also
caught and fixed a real bug — every error this module threw (not just render
failures) was reaching JS as the literal string `"undefined reason"` instead
of its actual message, because `Exception`'s JS-visible message reads its
`reason` property (always `debugDescription`), not the `description` passed
to `Exception(name:description:code:)`. Fixed by subclassing `Exception` to
override `reason` — see the `fix(ios)` commit for detail.

## Android — adapted from `pro_video_editor`

| This package | `pro_video_editor` source | Notes |
| --- | --- | --- |
| `android/.../src/core/constants/LoggingConstants.kt` | `android/.../src/core/constants/LoggingConstants.kt` | Only `RENDER_TAG` ported (render scope only); tag renamed `ProVideoEditor` → `ExpoProVideoEditor`. Upstream declares this in Kotlin's default package; given an explicit package here (see below). |
| `android/.../src/shared/logging/PluginLog.kt` | `android/.../src/shared/logging/PluginLog.kt` | Verbatim logic; the reflective `BuildConfig` class lookup repointed at this package's own `BuildConfig`; doc comments referencing "Dart"/"Flutter" reworded for a JS/Expo audience. |
| `android/.../src/shared/concurrency/ExportGate.kt` | `android/.../src/shared/concurrency/ExportGate.kt` | Verbatim; doc comments reworded ("the split and render pipelines" → "the render pipeline", "the MethodChannel handler" → "the Expo Modules API's `AsyncFunction` handler"). Carries `ExportGateGuard` in the same file, same as upstream. |
| `android/.../src/shared/media/EncodedImage.kt` | `android/.../src/shared/media/EncodedImage.kt` | Verbatim logic; doc comments referencing "the method channel"/"Dart" reworded to "the JS boundary". |
| `android/.../src/shared/media/PcmRangeDecoder.kt` | `android/.../src/shared/media/PcmRangeDecoder.kt` | Verbatim, no changes. |
| `android/.../src/shared/media/ImageOrientation.kt` | `android/.../src/shared/media/ImageOrientation.kt` | Verbatim, no changes. |
| `android/.../src/features/render/models/RenderConfig.kt` | `android/.../src/features/render/models/RenderConfig.kt` | `fromMethodCall(call: MethodCall)` replaced with `fromArguments(args: Map<String, Any?>)`, reading the same fields directly off the map instead of through `call.argument<T>(key)` — the Kotlin equivalent of the iOS port's `fromMethodCall` → `fromArguments` adaptation. Carries `TransitionConfig`, `VideoClip`, `SegmentTransformConfig`, `LayerConfig`, `CompositionConfig`, `ColorFilterConfig`, `ChromaKeyConfig`, `AudioTrackConfig`, `LayerAnimationConfig`, `ImageLayer` in the same file, same as upstream. |
| `android/.../src/features/render/models/RenderJobHandle.kt` | `android/.../src/features/render/models/RenderJobHandle.kt` | Verbatim, no changes. |
| `android/.../src/features/render/models/CodecResourceExhaustedException.kt` | `android/.../src/features/render/models/CodecResourceExhaustedException.kt` | Verbatim, no changes. |
| `android/.../src/features/render/models/VideoEncoderConfigurationException.kt` | `android/.../src/features/render/models/VideoEncoderConfigurationException.kt` | Verbatim; one doc comment referencing "the Flutter layer" reworded to "this module". |
| `android/.../src/features/render/utils/VideoMimeUtils.kt` | `android/.../src/features/render/utils/VideoMimeUtils.kt` | Verbatim, no changes. Upstream declares this in Kotlin's default package; given an explicit package here. |
| `android/.../src/features/render/utils/RotatedVideoDimensions.kt` | `android/.../src/features/render/utils/RotatedVideoDimensions.kt` | Verbatim, no changes. |
| `android/.../src/features/render/EffectsProcessor.kt` | `android/.../src/features/render/utils/EffectsProcessor.kt` | Verbatim logic; moved to match its own declared package (`...features.render`, not `...features.render.utils` — an upstream directory/package mismatch, not preserved here). |
| `android/.../src/features/render/helpers/ApplyRotation.kt` | `android/.../src/features/render/helpers/ApplyRotation.kt` | Verbatim logic. Upstream default-package file; given an explicit package plus an added `RENDER_TAG` import. |
| `android/.../src/features/render/helpers/ApplyFlip.kt` | `android/.../src/features/render/helpers/ApplyFlip.kt` | Same treatment as `ApplyRotation.kt`. |
| `android/.../src/features/render/helpers/ApplyScale.kt` | `android/.../src/features/render/helpers/ApplyScale.kt` | Same treatment as `ApplyRotation.kt`. |
| `android/.../src/features/render/helpers/ApplyFrameRate.kt` | `android/.../src/features/render/helpers/ApplyFrameRate.kt` | Same treatment as `ApplyRotation.kt`. |
| `android/.../src/features/render/helpers/ApplyPlaybackSpeed.kt` | `android/.../src/features/render/helpers/ApplyPlaybackSpeed.kt` | Same treatment as `ApplyRotation.kt`. |
| `android/.../src/features/render/helpers/ApplyBlur.kt` | `android/.../src/features/render/helpers/ApplyBlur.kt` | Same treatment as `ApplyRotation.kt`. |
| `android/.../src/features/render/helpers/ApplyColorMatrix.kt` | `android/.../src/features/render/helpers/ApplyColorMatrix.kt` | Same treatment as `ApplyRotation.kt`, plus its `ColorFilterConfig` import repointed at `RenderConfig.kt`. |
| `android/.../src/features/render/helpers/ApplyBitrate.kt` | `android/.../src/features/render/helpers/ApplyBitrate.kt` | Same treatment as `ApplyRotation.kt`. Carries `BitrateChoice` in the same file, same as upstream. |
| `android/.../src/features/render/helpers/ApplyCrop.kt` | `android/.../src/features/render/helpers/ApplyCrop.kt` | Same treatment as `ApplyRotation.kt`. |
| `android/.../src/features/render/helpers/ApplyOpacity.kt` | `android/.../src/features/render/helpers/ApplyOpacity.kt` | Same treatment as `ApplyRotation.kt`. |
| `android/.../src/features/render/helpers/ApplyChromaKey.kt` | `android/.../src/features/render/helpers/ApplyChromaKey.kt` | Upstream default-package file; given an explicit package plus `RENDER_TAG` and `ChromaKeyConfig` imports (the latter now in `RenderConfig.kt`). References `ChromaKeyEffect`, ported separately. |
| `android/.../src/features/render/helpers/ChromaKeyMath.kt` | `android/.../src/features/render/helpers/ChromaKeyMath.kt` | Verbatim logic; `ChromaKeyConfig` import repointed at `RenderConfig.kt`. |
| `android/.../src/features/render/helpers/ChromaKeyEffect.kt` | `android/.../src/features/render/helpers/ChromaKeyEffect.kt` | Verbatim logic; imports repointed (`RENDER_TAG`, `ChromaKeyConfig`, `ImageOrientation`). |
| `android/.../src/features/render/helpers/ApplyAnimation.kt` | `android/.../src/features/render/helpers/ApplyAnimation.kt` | Verbatim, no changes. Carries `SlideOffset`, `OverlayAnchors`, `AnimatedBitmapOverlay`, and the `applyEasing`/`slideOffset`/`resolveAnchor` helpers, same as upstream. |
| `android/.../src/features/render/helpers/ApplyImageLayer.kt` | `android/.../src/features/render/helpers/ApplyImageLayer.kt` | Verbatim logic; `RENDER_TAG` import added. Carries `applyTimedImageLayers`, `resolveOpenEndedOutAnimations`, `overlayDecodeSize`, and the bitmap-prep/rotate/unpremultiply helpers, same as upstream. |
| `android/.../src/features/render/helpers/ApplyClipTransition.kt` | `android/.../src/features/render/helpers/ApplyClipTransition.kt` | Verbatim, no changes. Carries `ClipFadeOverlay`. |
| `android/.../src/features/render/helpers/GifDecoder.kt` | `android/.../src/features/render/helpers/GifDecoder.kt` | Verbatim, no changes. |
| `android/.../src/features/render/helpers/ClipTransitionGeometry.kt` | `android/.../src/features/render/helpers/ClipTransitionGeometry.kt` | Verbatim, no changes. |
| `android/.../src/features/render/helpers/ClipTransitionRenderer.kt` | `android/.../src/features/render/helpers/ClipTransitionRenderer.kt` | Verbatim logic; `RENDER_TAG` import added. |
| `android/.../src/features/render/helpers/VideoEncoderConfig.kt` | `android/.../src/features/render/helpers/VideoEncoderConfig.kt` | Verbatim, no changes. |
| `android/.../src/features/render/helpers/VideoGlobalTrimCalculator.kt` | `android/.../src/features/render/helpers/VideoGlobalTrimCalculator.kt` | Verbatim, no changes. |
| `android/.../src/features/render/helpers/VideoTimelineDurationCalculator.kt` | `android/.../src/features/render/helpers/VideoTimelineDurationCalculator.kt` | Verbatim, no changes. |
| `android/.../src/features/render/helpers/BitrateCapPolicy.kt` | `android/.../src/features/render/helpers/BitrateCapPolicy.kt` | Verbatim, no changes. |
| `android/.../src/features/render/helpers/EncoderFailureClassifier.kt` | `android/.../src/features/render/helpers/EncoderFailureClassifier.kt` | Verbatim, no changes. |
| `android/.../src/features/render/helpers/ResilientVideoEncoderFactory.kt` | `android/.../src/features/render/helpers/ResilientVideoEncoderFactory.kt` | Verbatim logic; `RENDER_TAG` import added, `BitrateChoice`/`resolveBitrateSettings` bare imports dropped now that both are same-package. |
| `android/.../src/features/render/helpers/MediaInfoExtractor.kt` | `android/.../src/features/render/helpers/MediaInfoExtractor.kt` | Verbatim logic; `RENDER_TAG` import added. |
| `android/.../src/features/render/helpers/ConfigurableInAppMp4Muxer.kt` | `android/.../src/features/render/helpers/ConfigurableInAppMp4Muxer.kt` | Verbatim, no changes (`androidx.media3.common.Metadata` is a Media3 class, unrelated to this package). |
| `android/.../src/features/render/helpers/VolumeAudioProcessor.kt` | `android/.../src/features/render/helpers/VolumeAudioProcessor.kt` | Verbatim logic; `RENDER_TAG` import added. |
| `android/.../src/features/render/helpers/VolumeControlAudioMixer.kt` | `android/.../src/features/render/helpers/VolumeControlAudioMixer.kt` | Verbatim logic; `RENDER_TAG` import added. |
| `android/.../src/features/render/helpers/AudioSequenceBuilder.kt` | `android/.../src/features/render/helpers/AudioSequenceBuilder.kt` | Verbatim logic; `RENDER_TAG` import added. |
| `android/.../src/features/render/helpers/AudioPreRenderer.kt` | `android/.../src/features/render/helpers/AudioPreRenderer.kt` | Verbatim logic; `RENDER_TAG`/`PcmRangeDecoder` imports repointed. |
| `android/.../src/features/render/helpers/VideoReverser.kt` | `android/.../src/features/render/helpers/VideoReverser.kt` | Verbatim, no changes beyond the `RENDER_TAG` import. |
| `android/.../src/features/render/helpers/VideoTranscoder.kt` | `android/.../src/features/render/helpers/VideoTranscoder.kt` | Verbatim logic; `RENDER_TAG` import added. |
| `android/.../src/features/render/helpers/VideoCompositionTransformation.kt` | `android/.../src/features/render/helpers/VideoCompositionTransformation.kt` | Verbatim; one doc comment referencing "the Flutter side" reworded to "the JS side". |
| `android/.../src/features/render/helpers/VideoSequenceBuilder.kt` | `android/.../src/features/render/helpers/VideoSequenceBuilder.kt` | Verbatim logic; imports repointed (`RENDER_TAG`, `applyChromaKey`, `applyScale`, and the `models`/`utils`/`shared` cross-package imports). Carries `ImageLayerConfig` and `CropConfig` nested types, same as upstream. |
| `android/.../src/features/render/helpers/CompositionBuilder.kt` | `android/.../src/features/render/helpers/CompositionBuilder.kt` | Verbatim logic; `RENDER_TAG`/`AudioTrackConfig`/`RenderConfig` imports repointed. |
| `android/.../src/features/render/helpers/ApplyComposition.kt` | `android/.../src/features/render/helpers/ApplyComposition.kt` | Verbatim logic; `RenderConfig` import repointed. Carries `CompositionResult`, same as upstream. |
| `android/.../src/features/render/helpers/LayeredCompositionBuilder.kt` | `android/.../src/features/render/helpers/LayeredCompositionBuilder.kt` | Verbatim logic; imports repointed (`RENDER_TAG`, `applyChromaKey`, and the `models` cross-package imports). |
| `android/.../src/features/render/RenderVideo.kt` | `android/.../src/features/render/RenderVideo.kt` | Verbatim logic; imports repointed (`RENDER_TAG`, `mapFormatToMimeType`, and every `models`/`helpers`/`shared` cross-package import); one doc comment referencing "the Flutter layer" reworded to "this module". Already exposes a plain Kotlin callback API (`onProgress`/`onComplete`/`onError`) with no Flutter dependency at all — the Flutter-specific glue lives one layer up, in `ProVideoEditorPlugin.kt`, which is not being ported (see below). |
| — (not ported) | `android/.../src/features/render/models/RenderTask.kt` | Deliberately **not** ported — same rationale as iOS's `RenderTask.swift`: this class only adapts `RenderVideo`'s plain-callback API into Flutter's method-channel `Result`/error convention, which Expo's `AsyncFunction`/`Promise` already does natively. |

## Android port status

All 45 native source files that `RenderVideo.render(...)` transitively depends
on have been ported (models, the full composition pipeline — single-track and
layered — every effect helper, transitions, audio pre-render/reverse/mix, the
resilient encoder factory, and the concurrency/logging/media shared layer).
None had any real Flutter dependency once traced past their imports — the only
one that did (`RenderConfig.fromMethodCall`, and `RenderTask.kt`, not ported at
all) is noted above. A handful of files (`ApplyAnimation`, `ApplyClipTransition`,
`ApplyCrop`, `ApplyImageLayer`, `ApplyOpacity`, `GifDecoder`, `ApplyComposition`)
were missed in the first dependency-discovery pass — same-package references
with no `import` line are invisible to an import-based scan — and were caught
by the compile-check step below, the same role the missing `ExportSessionDriver.swift`
played on iOS.

Roughly a third of upstream's `helpers/` files (`ApplyRotation`, `ApplyFlip`,
`ApplyScale`, `ApplyFrameRate`, `ApplyPlaybackSpeed`, `ApplyBlur`,
`ApplyChromaKey`, `ApplyColorMatrix`, `ApplyBitrate`, `ApplyCrop`,
`ApplyOpacity`, `VideoMimeUtils`) declare no package at all upstream (Kotlin's
default/unnamed package), relying on that for same-package access to
`RENDER_TAG` and each other despite living in nested directories — an upstream
inconsistency, not preserved here. Every ported file gets an explicit package
matching its destination directory, with whatever new imports that requires.

**Verified**: the full set compiles cleanly via
`./gradlew :expo-pro-video-editor:compileDebugKotlin` (`BUILD SUCCESSFUL`)
against the example app's generated Android project. Only pre-existing
upstream deprecation warnings surface (`SpeedChangeEffect`,
`EditedMediaItemSequence.Builder(vararg)`, `Movie`) — none introduced by the
port.

**Verified at runtime** on an Android emulator (API 36, Pixel 7) via the same
smoke-test screen used for iOS: download a small public clip, `render()` a
3-second trim, resolve real output bytes (~1.08MB from the same 5s/1.1MB
source). This caught a real bug on the first attempt — see the module glue
section below.

## Android module glue (JS-callable)

`ExpoProVideoEditorModule.kt` exposes `render(config, id)` and `cancelRender(id)`
as `AsyncFunction`s (Kotlin's explicit-`Promise`-parameter form, matching
`ExpoProVideoEditorModule.swift`'s pattern) plus an `onRenderProgress` event —
the same role `ProVideoEditorPlugin.kt`'s `renderVideo`/`cancelTask`
method-channel handlers and `RenderTask.kt` played for Flutter. Kotlin's
`CodedException` needed no `Exception.reason`-style workaround: unlike iOS's
`Exception`, whose JS-visible message reads a separate `reason` property (see
the iOS `fix(ios)` commit), `CodedException`'s `message` constructor argument
is exactly what reaches JS.

The render config crosses the JS boundary as a **raw map** (`Map<String,
Any?>` on the Kotlin side, a plain object in TS), handed straight to the
already-ported `RenderConfig.fromArguments(_:)` unchanged — the same choice
made on iOS, rather than re-modeling `RenderConfig`'s shape as a second
parallel tree of Expo `Record` structs.

**Verified**: compiles clean as part of the same
`:expo-pro-video-editor:compileDebugKotlin` build, and confirmed working at
runtime (see above) after one fix: Expo Modules API dispatches an
`AsyncFunction` on a background queue by default, but Media3's `Transformer`
requires every call — including `addListener`, invoked from `RenderVideo`'s
own main-Looper `post` — on the exact thread that created it. Building the
`Transformer` on the default background queue crashed the first render with
`IllegalStateException: Transformer is accessed on the wrong thread` the
moment the main-thread callback touched it. Fixed by chaining
`.runOnQueue(Queues.MAIN)` onto both `AsyncFunction`s so the whole call stays
on the single thread Media3 expects throughout — see the `fix(android)`
commit for detail. No equivalent issue exists on iOS: `AVFoundation`'s
`Transformer`-equivalent objects aren't thread-affine the same way, and the
Expo Modules API's Swift side already runs `AsyncFunction` bodies
consistently.

## Written new for this package

Not every native file is a port. `pro_video_editor` has its own waveform
extraction (`darwin/.../shared/features/waveform/WaveformGenerator.swift`,
`android/.../features/waveform/WaveformGenerator.kt`, each paired with a
`WaveformConfig`/`WaveformTask` model and a streaming/chunk-map API), but this
package's `extractWaveform` is independent code, not adapted from those files:

| This package | Notes |
| --- | --- |
| `ios/src/features/render/helpers/WaveformExtractor.swift` | New. Streams PCM via `AVAssetReader`/`AVAssetReaderTrackOutput` and folds samples directly into per-bucket peaks as they're read, rather than `pro_video_editor`'s config/task/chunk-map layer. Reuses `MediaInfoExtractor` (ported) to locate the audio track. |
| `android/src/main/java/expo/modules/provideoeditor/src/features/render/helpers/WaveformExtractor.kt` | New. Same peak-per-bucket approach on Android's side; demuxes via `MediaExtractor` and decodes through this codebase's existing `PcmRangeDecoder` helper rather than `pro_video_editor`'s own `WaveformGenerator.kt`/`MediaCodec` loop. |

Both arrive at a similar high-level shape to `pro_video_editor`'s
implementation (read raw PCM, fold into peak buckets) — the natural way to
do this on each platform.

## Remaining work

The TS-facing API surface for anything beyond trim/basic effects (filters,
image/text overlays, audio mixing, transitions) is modeled in `RenderConfig`
on both platforms already and compiles, but only the trim path has been
exercised at runtime so far on either platform — filters, image layers, audio
mixing, and transitions are still untested end-to-end on iOS and Android
alike.
