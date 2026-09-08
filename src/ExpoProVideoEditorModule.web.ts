import { registerWebModule, NativeModule } from 'expo';

import type { ExpoProVideoEditorModuleEvents, RenderConfig } from './ExpoProVideoEditor.types';

const UNSUPPORTED_MESSAGE =
  'expo-pro-video-editor has no web implementation — its native composition engine ' +
  '(AVFoundation on iOS, Media3 Transformer on Android) has no browser equivalent.';

/**
 * ExpoProVideoEditorModule is not available on the web platform. Every method
 * throws explicitly rather than being silently undefined, so a web build
 * fails loudly at the call site instead of crashing on a missing function.
 */
class ExpoProVideoEditorModule extends NativeModule<ExpoProVideoEditorModuleEvents> {
  render(_config: RenderConfig, _id: string): Promise<Uint8Array | null> {
    throw new Error(UNSUPPORTED_MESSAGE);
  }

  cancelRender(_id: string): Promise<null> {
    throw new Error(UNSUPPORTED_MESSAGE);
  }

  extractWaveform(_inputPath: string, _bucketCount: number): Promise<number[]> {
    throw new Error(UNSUPPORTED_MESSAGE);
  }
}

export default registerWebModule(ExpoProVideoEditorModule, 'ExpoProVideoEditorModule');
