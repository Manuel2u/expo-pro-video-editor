import { Image } from 'expo-image';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { tv } from 'tailwind-variants';

const STRIP_HEIGHT = 40;
const FRAME_COUNT = 12;
const SOURCE_LOAD_TIMEOUT_MS = 8000;
const WAVEFORM_BAR_COUNT = 40;
const WAVEFORM_BAR_GAP = 3;
const WAVEFORM_MIN_BAR_HEIGHT = 3;
/**
 * expo-audio reports metering in dBFS (roughly -160..0); anything quieter
 * than this reads as silence rather than a barely-visible sliver of a bar.
 */
const METERING_FLOOR_DB = -50;

const styles = {
  container: tv({
    base: 'h-10 flex-row overflow-hidden rounded-lg bg-video-editor-surface',
  }),
  loadingOverlay: tv({ base: 'absolute inset-0 items-center justify-center' }),
  /**
   * Distinct from the pink trim/waveform accent — an active recording is
   * its own state, not a trim selection.
   */
  playedOverlay: tv({
    base: 'absolute bottom-0 left-0 top-0 bg-video-editor-recording/35',
  }),
  playhead: tv({ base: 'absolute bottom-0 top-0 w-0.5 bg-video-editor-recording' }),
  waveformRow: tv({
    base: 'h-10 flex-1 flex-row items-center justify-center gap-[3px] rounded-lg bg-video-editor-surface px-2',
  }),
  waveformBar: tv({ base: 'rounded-full bg-video-editor-recording' }),
};

function waitForSourceLoad(player: ReturnType<typeof createVideoPlayer>): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error('Timed out waiting for sourceLoad'));
    }, SOURCE_LOAD_TIMEOUT_MS);

    const subscription = player.addListener('sourceLoad', () => {
      clearTimeout(timeout);
      subscription.remove();
      resolve();
    });
  });
}

/** One decoded thumbnail per frame slot, generated once for the given clip. */
function useClipFrames(uri: string | null, durationSeconds: number) {
  const [frames, setFrames] = useState<VideoThumbnail[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!uri || durationSeconds <= 0) return;
    let cancelled = false;

    async function generate() {
      setIsLoading(true);
      const player = createVideoPlayer(uri as string);
      try {
        await waitForSourceLoad(player);
        const safeDuration = Math.max(0, durationSeconds - 0.05);
        const times = Array.from({ length: FRAME_COUNT }, (_, i) => (FRAME_COUNT <= 1 ? 0 : (i / (FRAME_COUNT - 1)) * safeDuration));
        const result = await player.generateThumbnailsAsync(times);
        player.release();
        if (!cancelled) {
          setFrames(result);
          setIsLoading(false);
        }
      } catch (error) {
        console.warn(`Recording filmstrip frame generation failed for ${uri}:`, error);
        player.release();
        if (!cancelled) setIsLoading(false);
      }
    }

    generate();
    return () => {
      cancelled = true;
    };
  }, [uri, durationSeconds]);

  return { frames, isLoading };
}

/** Scrolling history of recent metering readings, normalized to 0..1. */
function useMeteringHistory(metering: number | undefined, isRecording: boolean) {
  const [history, setHistory] = useState<number[]>(() => Array(WAVEFORM_BAR_COUNT).fill(0));

  /**
   * Reset when isRecording turns false, computed during render (not an
   * effect) so it applies on the same pass rather than one render late.
   */
  const [wasRecording, setWasRecording] = useState(isRecording);
  if (isRecording !== wasRecording) {
    setWasRecording(isRecording);
    if (!isRecording) setHistory(Array(WAVEFORM_BAR_COUNT).fill(0));
  }

  useEffect(() => {
    if (!isRecording) return;
    const normalized = metering === undefined ? 0 : Math.min(1, Math.max(0, (metering - METERING_FLOOR_DB) / -METERING_FLOOR_DB));
    queueMicrotask(() => setHistory(prev => [...prev.slice(1), normalized]));
  }, [metering, isRecording]);

  return history;
}

/**
 * Live progress indicator shown while recording. `mode: 'filmstrip'` shows
 * the video's own frames with a moving playhead (so the user can see the
 * end of the clip coming); `mode: 'waveform'` shows a live mic-amplitude
 * bar graph instead, for recording contexts with no video (e.g. a chat
 * voice message).
 */
export function RecordingIndicator(
  props:
    | {
        mode: 'filmstrip';
        uri: string | null;
        durationSeconds: number;
        currentTime: number;
        width: number;
      }
    | {
        mode: 'waveform';
        /** Current metering level in dBFS (from expo-audio's
         * `RecorderState.metering`, with `isMeteringEnabled: true` set on
         * the recording options), or `undefined` before the first reading. */
        metering: number | undefined;
        isRecording: boolean;
        width: number;
      },
) {
  if (props.mode === 'waveform') {
    return <WaveformIndicator {...props} />;
  }
  return <FilmstripIndicator {...props} />;
}

function FilmstripIndicator(props: { uri: string | null; durationSeconds: number; currentTime: number; width: number }) {
  const { uri, durationSeconds, currentTime, width } = props;
  const { frames, isLoading } = useClipFrames(uri, durationSeconds);

  const playedFraction = durationSeconds > 0 ? Math.min(1, currentTime / durationSeconds) : 0;
  const playheadX = playedFraction * width;
  const frameWidth = frames.length > 0 ? width / frames.length : 0;

  return (
    <View className={styles.container()} style={{ width }}>
      {frames.map((frame, index) => (
        <View key={index} style={{ width: frameWidth, height: STRIP_HEIGHT }}>
          <Image source={frame} style={{ flex: 1 }} contentFit="cover" />
        </View>
      ))}
      {isLoading ? (
        <View className={styles.loadingOverlay()}>
          <ActivityIndicator size="small" />
        </View>
      ) : null}
      <View pointerEvents="none" className={styles.playedOverlay()} style={{ width: playheadX }} />
      <View pointerEvents="none" className={styles.playhead()} style={{ left: playheadX }} />
    </View>
  );
}

function WaveformIndicator(props: { metering: number | undefined; isRecording: boolean; width: number }) {
  const { metering, isRecording, width } = props;
  const history = useMeteringHistory(metering, isRecording);
  const barWidth = Math.max(1, width / WAVEFORM_BAR_COUNT - WAVEFORM_BAR_GAP);

  return (
    <View className={styles.waveformRow()} style={{ width }}>
      {history.map((level, index) => (
        <View
          key={index}
          className={styles.waveformBar()}
          style={{
            width: barWidth,
            height: Math.max(WAVEFORM_MIN_BAR_HEIGHT, level * STRIP_HEIGHT),
          }}
        />
      ))}
    </View>
  );
}
