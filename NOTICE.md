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
