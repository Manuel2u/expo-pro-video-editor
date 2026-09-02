/**
 * Field names and shapes here must match exactly what the native
 * `RenderConfig.fromArguments` (iOS) / the Android equivalent parses — Expo
 * bridges a plain JS object to a native dictionary by key name, so there is no
 * separate serialization step to keep in sync.
 */

export type EasingCurve =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'bounceIn'
  | 'bounceOut'
  | 'bounceInOut'
  | 'elasticIn'
  | 'elasticOut'
  | 'elasticInOut';

export interface ClipTransition {
  type: 'dissolve' | 'fadeToBlack' | 'fadeToWhite' | 'slide' | 'push' | 'wipe';
  durationUs: number;
  curve?: EasingCurve;
  /** Only meaningful for "slide" / "push" / "wipe". */
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface ChromaKey {
  /** Screen color to remove, as a 0xRRGGBB (or 0xAARRGGBB) integer. */
  keyColor: number;
  similarity?: number;
  smoothness?: number;
  spill?: number;
  /** Solid background color (0xAARRGGBB) filling the keyed area. */
  bgColor?: number;
  bgImagePath?: string;
  bgImageData?: Uint8Array;
}

export interface VideoClip {
  inputPath: string;
  /** Trim window within the source, in microseconds. */
  startUs?: number;
  endUs?: number;
  /** 0...1+, original volume when omitted. */
  volume?: number;
  /** e.g. 2.0 = double speed, 0.5 = half speed. */
  playbackSpeed?: number;
  reverseVideo?: boolean;
  transition?: ClipTransition;
  chromaKey?: ChromaKey;
}

export interface LayerAnimation {
  type: 'fade' | 'slide' | 'scale';
  phase: 'animateIn' | 'animateOut' | 'animateInOut';
  durationUs: number;
  curve?: EasingCurve;
  slideDirection?: 'left' | 'right' | 'top' | 'bottom';
  scaleFrom?: number;
}

export interface ImageLayer {
  imagePath?: string;
  imageData?: Uint8Array;
  /** -1 (or omitted) = from the start of the video. */
  startUs?: number;
  /** -1 (or omitted) = until the end of the video. */
  endUs?: number;
  /** Pixel position; omitted on both axes stretches to the frame. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Clockwise rotation in radians. */
  rotation?: number;
  loop?: boolean;
  animations?: LayerAnimation[];
}

export interface ColorFilter {
  /** 4x5 RGBA + offset transformation matrix, 20 values. */
  matrix: number[];
  startUs?: number;
  endUs?: number;
}

export interface AudioTrack {
  path: string;
  volume?: number;
  loop?: boolean;
  /** Trim window within the audio file, in microseconds. */
  audioStartUs?: number;
  audioEndUs?: number;
  /** Where on the composition timeline this track plays, in microseconds. */
  startUs?: number;
  endUs?: number;
}

export interface RenderConfig {
  videoClips: VideoClip[];
  outputFormat?: 'mp4' | 'mov';
  /** Absolute path to write the output to; omitted resolves to raw bytes. */
  outputPath?: string;
  /** Number of 90° clockwise rotations (0-3), negative allowed. */
  rotateTurns?: number;
  flipX?: boolean;
  flipY?: boolean;
  cropWidth?: number;
  cropHeight?: number;
  cropX?: number;
  cropY?: number;
  scaleX?: number;
  scaleY?: number;
  /** Exact output canvas size; the composed frame is letterboxed into it. */
  outputWidth?: number;
  outputHeight?: number;
  /** Target bitrate in bits per second. */
  bitrate?: number;
  maxFrameRate?: number;
  enableAudio?: boolean;
  trimToCommonTrackEnd?: boolean;
  playbackSpeed?: number;
  colorFilters?: ColorFilter[];
  audioTracks?: AudioTrack[];
  imageLayers?: ImageLayer[];
  /** Gaussian blur radius; 0 or omitted disables it. */
  blur?: number;
  chromaKey?: ChromaKey;
  /** Global trim of the final composition, in microseconds. */
  startUs?: number;
  endUs?: number;
  shouldOptimizeForNetworkUse?: boolean;
  imageBytesWithCropping?: boolean;
}

export interface RenderProgressEvent {
  id: string;
  /** 0...1. */
  progress: number;
}

export type ExpoProVideoEditorModuleEvents = {
  onRenderProgress: (event: RenderProgressEvent) => void;
};
