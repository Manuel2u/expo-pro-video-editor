import { Image } from 'expo-image';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, View } from 'react-native';
import { tv } from 'tailwind-variants';

const HANDLE_WIDTH = 18;
const STRIP_HEIGHT = 51;
const MIN_TRIM_SECONDS = 0.5;
const FRAME_COUNT = 12;
const SOURCE_LOAD_TIMEOUT_MS = 8000;

export type TimelineClip = {
  uri: string;
  durationSeconds: number;
};

const styles = {
  container: tv({ base: 'h-[51px] justify-center overflow-hidden rounded-[10px]' }),
  filmstrip: tv({ base: 'h-[51px] flex-row overflow-hidden' }),
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
  selectionBorder: tv({
    base: 'absolute top-0 h-[51px] border-y-4 border-video-editor-accent',
  }),
  loadingOverlay: tv({ base: 'absolute inset-0 items-center justify-center' }),
  handle: tv({
    base: 'absolute top-0 h-[51px] w-[18px] items-center justify-center bg-video-editor-accent',
    variants: {
      side: {
        start: 'rounded-l-[10px]',
        end: 'rounded-r-[10px]',
      },
    },
  }),
  handleGrip: tv({ base: 'h-[29px] w-0.5 rounded-full bg-white' }),
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

async function generateClipFrames(uri: string, durationSeconds: number, frameCount: number) {
  const player = createVideoPlayer(uri);
  try {
    await waitForSourceLoad(player);
    /**
     * The last timestamp below lands exactly at durationSeconds, which is
     * past the clip's last valid frame. generateThumbnailsAsync() takes all
     * timestamps in one batched call, so one out-of-range value fails the
     * whole batch — pull it back slightly so every requested frame succeeds.
     */
    const safeDuration = Math.max(0, durationSeconds - 0.05);
    const times = Array.from({ length: frameCount }, (_, i) => (frameCount <= 1 ? 0 : (i / (frameCount - 1)) * safeDuration));
    return await player.generateThumbnailsAsync(times);
  } finally {
    player.release();
  }
}

/**
 * One filmstrip spanning every clip on the timeline, frame tiles allotted
 * proportionally to each clip's share of the total duration so the merged
 * bar reads as a single continuous strip, not per-clip strips glued
 * together. A single-clip trim UI is just a one-element `clips` array.
 */
function useMergedFilmstrip(clips: TimelineClip[]) {
  const [framesByClip, setFramesByClip] = useState<Record<number, VideoThumbnail[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const totalDuration = clips.reduce((sum, clip) => sum + clip.durationSeconds, 0);

  useEffect(() => {
    if (clips.length === 0 || totalDuration <= 0) return;
    let cancelled = false;

    async function generate() {
      setIsLoading(true);
      const results = await Promise.all(
        clips.map(async (clip, index) => {
          const share = clip.durationSeconds / totalDuration;
          const frameCount = Math.max(1, Math.round(FRAME_COUNT * share));
          try {
            const frames = await generateClipFrames(clip.uri, clip.durationSeconds, frameCount);
            return { index, frames };
          } catch (error) {
            console.warn(`Filmstrip frame generation failed for clip ${index}:`, error);
            return { index, frames: [] as VideoThumbnail[] };
          }
        }),
      );
      if (cancelled) return;
      const next: Record<number, VideoThumbnail[]> = {};
      for (const result of results) next[result.index] = result.frames;
      setFramesByClip(next);
      setIsLoading(false);
    }

    generate();
    return () => {
      cancelled = true;
    };
  }, [clips.map(c => c.uri).join('|'), totalDuration]);

  const tiles = useMemo(
    () =>
      clips.flatMap((clip, index) =>
        (framesByClip[index] ?? []).map((frame, frameIndex) => ({
          key: `${index}-${frameIndex}`,
          frame,
          dimmed: index % 2 === 1,
        })),
      ),
    [clips, framesByClip],
  );

  return { tiles, isLoading, totalDuration };
}

/**
 * The merged timeline bar: a continuous filmstrip built from every clip on
 * the video track (proportioned by duration), with two drag handles
 * constraining the overall trimmed window reported back in seconds against
 * the FULL merged duration.
 */
export function TrimScrubber(props: {
  clips: TimelineClip[];
  startSeconds: number;
  endSeconds: number;
  onChange: (range: { startSeconds: number; endSeconds: number }) => void;
  width: number;
}) {
  const { clips, startSeconds, endSeconds, onChange, width } = props;
  const { tiles, isLoading, totalDuration } = useMergedFilmstrip(clips);

  const startXRef = useRef(startSeconds);
  const endXRef = useRef(endSeconds);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    startXRef.current = startSeconds;
    endXRef.current = endSeconds;
    onChangeRef.current = onChange;
  });

  /**
   * Anchors captured once per gesture (onPanResponderGrant) — `gesture.dx` is
   * the cumulative delta from gesture START, so the new position must be
   * computed from a FIXED starting point, not from the live (already
   * mid-drag-updated) ref. Applying dx on top of a base that itself moves
   * every event double-counts the movement and produces the jumpy/runaway
   * drag.
   */
  const startGestureAnchorRef = useRef(0);
  const endGestureAnchorRef = useRef(0);

  const usableWidth = width - HANDLE_WIDTH * 2;

  function secondsToX(seconds: number) {
    if (totalDuration <= 0) return 0;
    return (seconds / totalDuration) * usableWidth;
  }

  const [panResponders, setPanResponders] = useState<{
    start: ReturnType<typeof PanResponder.create>;
    end: ReturnType<typeof PanResponder.create>;
  } | null>(null);

  useEffect(() => {
    function secondsToXCurrent(seconds: number) {
      if (totalDuration <= 0) return 0;
      return (seconds / totalDuration) * usableWidth;
    }

    function xToSecondsCurrent(x: number) {
      if (usableWidth <= 0) return 0;
      return (x / usableWidth) * totalDuration;
    }

    setPanResponders({
      start: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startGestureAnchorRef.current = secondsToXCurrent(startXRef.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextSeconds = xToSecondsCurrent(startGestureAnchorRef.current + gesture.dx);
          const clamped = Math.max(0, Math.min(nextSeconds, endXRef.current - MIN_TRIM_SECONDS));
          onChangeRef.current({ startSeconds: clamped, endSeconds: endXRef.current });
        },
      }),
      end: PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          endGestureAnchorRef.current = secondsToXCurrent(endXRef.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextSeconds = xToSecondsCurrent(endGestureAnchorRef.current + gesture.dx);
          const clamped = Math.min(totalDuration, Math.max(nextSeconds, startXRef.current + MIN_TRIM_SECONDS));
          onChangeRef.current({ startSeconds: startXRef.current, endSeconds: clamped });
        },
      }),
    });
  }, [totalDuration, usableWidth]);

  /**
   * Handle centers sit at the edges of the selected window; the window itself
   * spans from the inner edge of the start handle to the inner edge of the
   * end handle, matching WhatsApp/Instagram's trim bar.
   */
  const startX = secondsToX(startSeconds);
  const endX = secondsToX(endSeconds);
  const frameWidth = tiles.length > 0 ? usableWidth / tiles.length : 0;

  /**
   * The accent top/bottom border only frames the SELECTED window and must
   * track the handles as they move. The dim overlay's OUTER corner (the one
   * touching the container's true edge) needs rounding whenever the handle
   * has moved away from that edge — the handle sits BETWEEN the container
   * edge and the dim overlay once startX/endX is nonzero, so it's the dim
   * overlay, not the handle, that's flush against the true corner then.
   */
  const isStartAtEdge = startX <= 0;
  const isEndAtEdge = endX >= usableWidth;

  return (
    <View className={styles.container()} style={{ width }}>
      <View className={styles.filmstrip()} style={{ width: usableWidth, marginHorizontal: HANDLE_WIDTH }}>
        {tiles.map(tile => (
          <View key={tile.key} style={{ width: frameWidth, height: STRIP_HEIGHT }}>
            <Image source={tile.frame} style={{ flex: 1 }} contentFit="cover" />
          </View>
        ))}
        {isLoading ? (
          <View className={styles.loadingOverlay()}>
            <ActivityIndicator size="small" />
          </View>
        ) : null}
        <View pointerEvents="none" className={styles.dimOverlay({ rounded: isStartAtEdge ? 'none' : 'start' })} style={{ left: 0, width: startX }} />
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
  );
}
