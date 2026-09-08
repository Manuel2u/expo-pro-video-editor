import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { tv } from 'tailwind-variants';

import ExpoProVideoEditorModule from '../ExpoProVideoEditorModule';
import { normalizeWaveformPeaks } from '../waveform';

const HANDLE_WIDTH = 18;
const STRIP_HEIGHT = 51;
const MIN_TRIM_SECONDS = 0.5;
const BAR_COUNT_PER_SECOND = 8;
const MIN_BAR_COUNT = 90;
const MAX_BAR_COUNT = 600;
const BAR_GAP = 1;
const MIN_BAR_HEIGHT = 3;
const MAX_BAR_HEIGHT = STRIP_HEIGHT - 10;
const DELETE_BUTTON_SIZE = 24;
// Width per second of audio, before scrolling kicks in.
const PIXELS_PER_SECOND = 40;

const styles = {
  row: tv({ base: 'h-[51px] flex-row items-center gap-2' }),
  scrollContainer: tv({ base: 'h-[51px]' }),
  container: tv({ base: 'h-[51px] justify-center overflow-hidden rounded-[10px]' }),
  waveform: tv({
    base: 'h-[51px] flex-row items-center justify-center gap-px overflow-hidden bg-video-editor-surface',
  }),
  bar: tv({
    base: 'rounded-full',
    variants: {
      played: {
        true: 'bg-video-editor-accent-light',
        false: 'bg-video-editor-bar-unplayed',
      },
    },
  }),
  selectionBorder: tv({
    base: 'absolute top-0 h-[51px] border-y-4 border-video-editor-accent-light',
  }),
  dimOverlay: tv({
    base: 'absolute bottom-0 top-0 bg-black/55',
    variants: {
      rounded: {
        start: 'rounded-l-[10px]',
        end: 'rounded-r-[10px]',
        none: '',
      },
    },
  }),
  loadingOverlay: tv({ base: 'absolute inset-0 items-center justify-center' }),
  handle: tv({
    base: 'absolute top-0 h-[51px] w-[18px] items-center justify-center bg-video-editor-accent-light',
    variants: {
      side: {
        start: 'rounded-l-[10px]',
        end: 'rounded-r-[10px]',
      },
    },
  }),
  handleGrip: tv({ base: 'h-[29px] w-0.5 rounded-full bg-white' }),
  deleteButton: tv({
    base: 'h-6 w-6 items-center justify-center rounded-full border-[0.5px] border-video-editor-border bg-white',
  }),
  deleteButtonText: tv({ base: 'text-xs text-video-editor-text' }),
};

/**
 * Independent trim UI for a standalone audio file (music / voice / a picked
 * file) — a waveform with drag handles marking the selected window. Long
 * tracks scroll horizontally so the user can pan to the part they want
 * before placing the handles; short tracks fit without scrolling.
 */
export function AudioTrimScrubber(props: {
  inputPath: string;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  /** The audio player's own current position, in this file's own time
   * base — used to color the played portion of the waveform. `null` while
   * not actively playing this track, so bars fall back to the unplayed
   * shade. */
  currentTime: number | null;
  onChange: (range: { startSeconds: number; endSeconds: number }) => void;
  onDelete?: () => void;
  width: number;
}) {
  const { inputPath, durationSeconds, startSeconds, endSeconds, currentTime, onChange, onDelete, width } = props;
  const deleteButtonSpace = onDelete ? DELETE_BUTTON_SIZE + 8 : 0;
  const scrubberWidth = width - deleteButtonSpace;
  /**
   * Keyed by the request that produced it, so a stale result is simply
   * never rendered — no separate reset-to-loading write is needed.
   */
  const [result, setResult] = useState<{ inputPath: string; barCount: number; peaks: number[] } | null>(null);

  const contentWidth = Math.max(scrubberWidth, durationSeconds * PIXELS_PER_SECOND);
  const usableContentWidth = contentWidth - HANDLE_WIDTH * 2;
  const barCount = Math.min(MAX_BAR_COUNT, Math.max(MIN_BAR_COUNT, Math.round(durationSeconds * BAR_COUNT_PER_SECOND)));

  useEffect(() => {
    let cancelled = false;

    ExpoProVideoEditorModule.extractWaveform(inputPath, barCount)
      .then(peaks => {
        if (cancelled) return;
        setResult({ inputPath, barCount, peaks: normalizeWaveformPeaks(peaks) });
      })
      .catch(error => {
        console.warn(`Waveform extraction failed for ${inputPath}:`, error);
      });

    return () => {
      cancelled = true;
    };
  }, [inputPath, barCount]);

  const peaks = result?.inputPath === inputPath && result.barCount === barCount ? result.peaks : null;

  /**
   * Mirrored into refs (in an effect, not during render) so the
   * PanResponder instances below — created once, in a later effect — always
   * read current values instead of whatever was in scope when built.
   */
  const startXRef = useRef(startSeconds);
  const endXRef = useRef(endSeconds);
  const durationSecondsRef = useRef(durationSeconds);
  const usableContentWidthRef = useRef(usableContentWidth);
  useEffect(() => {
    startXRef.current = startSeconds;
    endXRef.current = endSeconds;
    durationSecondsRef.current = durationSeconds;
    usableContentWidthRef.current = usableContentWidth;
  });

  const startGestureAnchorRef = useRef(0);
  const endGestureAnchorRef = useRef(0);
  /**
   * The trim handles sit inside the horizontal ScrollView, so a drag on a
   * handle is ambiguous with the ScrollView's own pan-to-scroll recognizer —
   * without this, dragging a handle also scrolls the content underneath it.
   * Disabling scroll for the duration of a handle drag (grant → release)
   * resolves the conflict outright instead of fighting gesture priority.
   */
  const [scrollEnabled, setScrollEnabled] = useState(true);

  function secondsToX(seconds: number) {
    if (durationSeconds <= 0) return 0;
    return (seconds / durationSeconds) * usableContentWidth;
  }

  /**
   * Built once, after mount, so PanResponder.create() never runs during
   * render — its callbacks read the refs above for live values.
   */
  const [panResponders, setPanResponders] = useState<{
    start: ReturnType<typeof PanResponder.create>;
    end: ReturnType<typeof PanResponder.create>;
  } | null>(null);

  useEffect(() => {
    function secondsToXCurrent(seconds: number) {
      if (durationSecondsRef.current <= 0) return 0;
      return (seconds / durationSecondsRef.current) * usableContentWidthRef.current;
    }

    function xToSecondsCurrent(x: number) {
      if (usableContentWidthRef.current <= 0) return 0;
      return (x / usableContentWidthRef.current) * durationSecondsRef.current;
    }

    setPanResponders({
      start: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setScrollEnabled(false);
          startGestureAnchorRef.current = secondsToXCurrent(startXRef.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextSeconds = xToSecondsCurrent(startGestureAnchorRef.current + gesture.dx);
          const clamped = Math.max(0, Math.min(nextSeconds, endXRef.current - MIN_TRIM_SECONDS));
          onChange({ startSeconds: clamped, endSeconds: endXRef.current });
        },
        onPanResponderRelease: () => setScrollEnabled(true),
        onPanResponderTerminate: () => setScrollEnabled(true),
      }),
      end: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setScrollEnabled(false);
          endGestureAnchorRef.current = secondsToXCurrent(endXRef.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextSeconds = xToSecondsCurrent(endGestureAnchorRef.current + gesture.dx);
          const clamped = Math.min(durationSecondsRef.current, Math.max(nextSeconds, startXRef.current + MIN_TRIM_SECONDS));
          onChange({ startSeconds: startXRef.current, endSeconds: clamped });
        },
        onPanResponderRelease: () => setScrollEnabled(true),
        onPanResponderTerminate: () => setScrollEnabled(true),
      }),
    });
  }, []);

  const startX = secondsToX(startSeconds);
  const endX = secondsToX(endSeconds);
  const barWidth = peaks && peaks.length > 0 ? usableContentWidth / peaks.length - BAR_GAP : 0;

  const isStartAtEdge = startX <= 0;
  const isEndAtEdge = endX >= usableContentWidth;

  const trimDuration = Math.max(0, endSeconds - startSeconds);
  const playedFraction = currentTime !== null && trimDuration > 0 ? Math.min(1, Math.max(0, (currentTime - startSeconds) / trimDuration)) : 0;
  const playedBarCount = currentTime !== null && peaks ? Math.round(playedFraction * peaks.length) : 0;

  return (
    <View className={styles.row()} style={{ width }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        className={styles.scrollContainer()}
        style={{ width: scrubberWidth }}
        contentContainerStyle={{ width: contentWidth }}>
        <View className={styles.container()} style={{ width: contentWidth }}>
          <View className={styles.waveform()} style={{ width: usableContentWidth, marginHorizontal: HANDLE_WIDTH }}>
            {peaks ? (
              peaks.map((peak, index) => (
                <View
                  key={index}
                  className={styles.bar({ played: index < playedBarCount })}
                  style={{
                    width: Math.max(1, barWidth),
                    height: Math.min(MAX_BAR_HEIGHT, Math.max(MIN_BAR_HEIGHT, peak * STRIP_HEIGHT)),
                  }}
                />
              ))
            ) : (
              <View className={styles.loadingOverlay()}>
                <ActivityIndicator size="small" />
              </View>
            )}
            <View
              pointerEvents="none"
              className={styles.dimOverlay({ rounded: isStartAtEdge ? 'none' : 'start' })}
              style={{ left: 0, width: startX }}
            />
            <View pointerEvents="none" className={styles.dimOverlay({ rounded: isEndAtEdge ? 'none' : 'end' })} style={{ left: endX, right: 0 }} />
            <View pointerEvents="none" className={styles.selectionBorder()} style={{ left: startX, width: endX - startX }} />
          </View>
          <View
            className={styles.handle({ side: 'start' })}
            style={{ left: startX }}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...panResponders?.start.panHandlers}>
            <View className={styles.handleGrip()} />
          </View>
          <View
            className={styles.handle({ side: 'end' })}
            style={{ left: endX + HANDLE_WIDTH }}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            {...panResponders?.end.panHandlers}>
            <View className={styles.handleGrip()} />
          </View>
        </View>
      </ScrollView>
      {onDelete ? (
        <TouchableOpacity className={styles.deleteButton()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={onDelete}>
          <Text className={styles.deleteButtonText()}>✕</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
