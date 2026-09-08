import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { tv } from 'tailwind-variants';

import ExpoProVideoEditorModule from '../ExpoProVideoEditorModule';
import { normalizeWaveformPeaks } from '../waveform';

const STRIP_HEIGHT = 51;
const BAR_COUNT = 90;
const BAR_GAP = 1;
const MIN_BAR_HEIGHT = 3;
/**
 * Leaves a visible gap above/below even the tallest bar so it never touches
 * the container's top/bottom edge, regardless of peak value.
 */
const MAX_BAR_HEIGHT = STRIP_HEIGHT - 10;
const DELETE_BUTTON_SIZE = 24;

const styles = {
  row: tv({ base: 'h-[51px] flex-row items-center gap-2' }),
  waveform: tv({
    base: 'h-[51px] flex-row items-center justify-center gap-px rounded-[10px] bg-video-editor-surface px-1.5',
  }),
  bar: tv({
    base: 'rounded-full',
    variants: {
      played: {
        true: 'bg-video-editor-bar-played',
        false: 'bg-video-editor-bar-unplayed',
      },
    },
  }),
  failedText: tv({ base: 'text-[11px] text-video-editor-text-muted' }),
  deleteButton: tv({
    base: 'h-6 w-6 items-center justify-center rounded-full border-[0.5px] border-video-editor-border bg-white',
  }),
  deleteButtonText: tv({ base: 'text-xs text-video-editor-text' }),
};

/**
 * A peak-amplitude waveform for a completed audio or video file — bars
 * mirror the standard voice-note look (Voice Memos, WhatsApp), with the
 * already-played portion turning solid while the rest stays dim.
 *
 * `onDelete` is optional: pass it to show a delete button (e.g. an editor
 * letting the user strip a clip's own audio track); omit it for a
 * read-only display (e.g. a chat bubble's voice message).
 */
export function AudioWaveform(props: {
  inputPath: string;
  width: number;
  currentTime: number;
  startSeconds: number;
  endSeconds: number;
  onDelete?: () => void;
  barCount?: number;
}) {
  const { inputPath, width, currentTime, startSeconds, endSeconds, onDelete, barCount = BAR_COUNT } = props;
  /**
   * Keyed by the request that produced it, so a stale result is simply
   * never rendered — no separate reset-to-loading write is needed.
   */
  const [result, setResult] = useState<{
    inputPath: string;
    barCount: number;
    peaks: number[] | null;
    /**
     * Distinguishes "this file genuinely has no audio track" (hide the row
     * entirely — there's nothing to show or delete) from a real extraction
     * failure worth surfacing (network/decode error on a file that does have
     * audio).
     */
    failureKind: 'none' | 'noAudioTrack' | 'error';
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    ExpoProVideoEditorModule.extractWaveform(inputPath, barCount)
      .then(peaks => {
        if (cancelled) return;
        setResult({ inputPath, barCount, peaks: normalizeWaveformPeaks(peaks), failureKind: 'none' });
      })
      .catch(error => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('No audio track found')) {
          setResult({ inputPath, barCount, peaks: null, failureKind: 'noAudioTrack' });
        } else {
          console.warn(`Waveform extraction failed for ${inputPath}:`, error);
          setResult({ inputPath, barCount, peaks: null, failureKind: 'error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [inputPath, barCount]);

  const current = result?.inputPath === inputPath && result.barCount === barCount ? result : null;
  const peaks = current?.peaks ?? null;
  const failureKind = current?.failureKind ?? 'none';

  const deleteButtonSpace = onDelete ? DELETE_BUTTON_SIZE + 8 : 0;
  const barsWidth = width - deleteButtonSpace;
  const barWidth = Math.max(1, barsWidth / barCount - BAR_GAP);

  const trimDuration = Math.max(0, endSeconds - startSeconds);
  const playedFraction = trimDuration > 0 ? Math.min(1, Math.max(0, (currentTime - startSeconds) / trimDuration)) : 0;
  const playedBarCount = Math.round(playedFraction * barCount);

  if (failureKind === 'noAudioTrack') return null;

  return (
    <View className={styles.row()} style={{ width }}>
      <View className={styles.waveform()} style={{ width: barsWidth }}>
        {peaks ? (
          peaks.map((peak, index) => (
            <View
              key={index}
              className={styles.bar({ played: index < playedBarCount })}
              style={{
                width: barWidth,
                height: Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, peak * STRIP_HEIGHT)),
              }}
            />
          ))
        ) : failureKind === 'error' ? (
          <Text className={styles.failedText()}>Couldn&apos;t load audio waveform</Text>
        ) : (
          <ActivityIndicator size="small" />
        )}
      </View>
      {onDelete ? (
        <TouchableOpacity className={styles.deleteButton()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onDelete}>
          <Text className={styles.deleteButtonText()}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
