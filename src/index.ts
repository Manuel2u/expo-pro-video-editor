/**
 * Reexport the native module. On web, it will be resolved to ExpoProVideoEditorModule.web.ts
 * and on native platforms to ExpoProVideoEditorModule.ts
 */
import type { RenderConfig } from './ExpoProVideoEditor.types';
import ExpoProVideoEditorModule from './ExpoProVideoEditorModule';

export { default } from './ExpoProVideoEditorModule';
export * from './ExpoProVideoEditor.types';
export { normalizeWaveformPeaks } from './waveform';

/**
 * Named re-exports of the native module's own methods, so callers can
 * `import { render, extractWaveform } from 'expo-pro-video-editor'` instead
 * of going through the default-exported module object — wrapped (rather
 * than destructured directly off the module instance) so `this` still
 * resolves to the native module regardless of how its methods are bound
 * internally.
 */
export const render: typeof ExpoProVideoEditorModule.render = (config: RenderConfig, id: string) => ExpoProVideoEditorModule.render(config, id);

export const cancelRender: typeof ExpoProVideoEditorModule.cancelRender = (id: string) => ExpoProVideoEditorModule.cancelRender(id);

export const extractWaveform: typeof ExpoProVideoEditorModule.extractWaveform = (inputPath: string, bucketCount: number) =>
  ExpoProVideoEditorModule.extractWaveform(inputPath, bucketCount);
export { AudioWaveform } from './ui/AudioWaveform';
export { AudioTrimScrubber } from './ui/AudioTrimScrubber';
export { TrimScrubber, type TimelineClip } from './ui/TrimScrubber';
export { RecordingIndicator } from './ui/RecordingIndicator';
export { VoiceRecorder, type VoiceRecorderResult, type VoiceRecorderContainer } from './ui/VoiceRecorder';
export { useTimelineClips } from './hooks/useTimelineClips';
export { waitForSourceLoad } from './utils/waitForSourceLoad';
