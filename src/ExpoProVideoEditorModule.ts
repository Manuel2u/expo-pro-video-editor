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
}

export default requireNativeModule<ExpoProVideoEditorModule>('ExpoProVideoEditor');
