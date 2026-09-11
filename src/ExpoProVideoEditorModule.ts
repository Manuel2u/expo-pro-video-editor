import { NativeModule, requireNativeModule } from 'expo';

import type { ExpoProVideoEditorModuleEvents, RenderConfig } from './ExpoProVideoEditor.types';

declare class ExpoProVideoEditorModule extends NativeModule<ExpoProVideoEditorModuleEvents> {
  /**
   * Renders `config` to a single video file, reporting progress via the
   * `onRenderProgress` event for the same `id`. Resolves with the output
   * bytes when `config.outputPath` is omitted, or `null` when it wrote
   * directly to that path.
   *
   * Rejects with a `CANCELED` error if `cancelRender(id)` is called (or the
   * pipeline cancels itself, e.g. a stalled-export watchdog) before it
   * finishes, or a `RENDER_ERROR` on any other failure.
   */
  render(config: RenderConfig, id: string): Promise<Uint8Array | null>;

  /** Cancels the render job started with `render(..., id)`, if still running. */
  cancelRender(id: string): Promise<null>;

  /**
   * Extracts a waveform from the first audio track of `inputPath` (video or
   * audio file), downsampled to `bucketCount` peak-amplitude values in the
   * `0...1` range, evenly spanning the file's full duration.
   *
   * Rejects with `INVALID_ARGUMENTS` if `bucketCount` is not positive, or
   * `WAVEFORM_ERROR` if the file has no audio track or cannot be read.
   */
  extractWaveform(inputPath: string, bucketCount: number): Promise<number[]>;

  /**
   * Exports a photo-library video asset to a real, playable local file at
   * `destinationPath`, using `PHImageManager.requestExportSession` — the API
   * Apple documents for producing a genuinely exportable representation of a
   * video asset. A `ph://` URI (or a resolved `file://` path under the
   * Photos app's own protected storage) cannot be opened directly by
   * AVPlayer/expo-video, and copying via `PHAssetResourceManager` has been
   * observed failing unpredictably on some devices/OS versions even for
   * locally-available assets — this is the more robust alternative.
   *
   * @param localIdentifier A `PHAsset.localIdentifier` — the part of a
   * `ph://<localIdentifier>/L0/001` URI before the `/L0/001` suffix.
   * @param destinationPath A `file://` path in the caller's own sandbox
   * (e.g. its cache directory) to write the exported `.mov` file to. Any
   * existing file at this path is overwritten.
   * @returns The same `destinationPath`, once the file has been written.
   *
   * @platform ios
   */
  exportPhotoLibraryVideo(localIdentifier: string, destinationPath: string): Promise<string>;
}

export default requireNativeModule<ExpoProVideoEditorModule>('ExpoProVideoEditor');
