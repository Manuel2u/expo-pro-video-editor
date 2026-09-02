import { Image } from 'expo-image';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, StyleSheet, View } from 'react-native';

import { colors } from '../../constants/colors';

const HANDLE_WIDTH = 10;
const HANDLE_HEIGHT = 23;
const STRIP_HEIGHT = 51;
const MIN_TRIM_SECONDS = 0.5;
const FRAME_COUNT = 12;
const SOURCE_LOAD_TIMEOUT_MS = 8000;

export type TimelineClip = {
  uri: string;
  durationSeconds: number;
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
    // Clamp shy of the exact end: requesting a thumbnail AT durationSeconds is
    // out of range and rejects the whole batched call, losing every frame in
    // it — not just the last one.
    const safeDuration = Math.max(0, durationSeconds - 0.05);
    const times = Array.from({ length: frameCount }, (_, i) =>
      frameCount <= 1 ? 0 : (i / (frameCount - 1)) * safeDuration,
    );
    return await player.generateThumbnailsAsync(times);
  } finally {
    player.release();
  }
}

/**
 * One filmstrip spanning every clip on the timeline, frame tiles allotted
 * proportionally to each clip's share of the total duration so the merged
 * bar reads as a single continuous strip (matching Figma), not per-clip
 * strips glued together.
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
      try {
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
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    generate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.map((c) => c.uri).join('|'), totalDuration]);

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
 * restyled to match Figma's playhead-marker look (a small rounded pill, not
 * a full-height flush-edge block) constraining the overall trimmed window
 * reported back in seconds against the FULL merged duration.
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
  startXRef.current = startSeconds;
  endXRef.current = endSeconds;

  // Anchors captured once per gesture (onPanResponderGrant) — `gesture.dx` is
  // the cumulative delta from gesture START, so the new position must be
  // computed from a FIXED starting point, not from the live (already
  // mid-drag-updated) ref. Applying dx on top of a base that itself moves
  // every event double-counts the movement and produces the jumpy/runaway
  // drag.
  const startGestureAnchorRef = useRef(0);
  const endGestureAnchorRef = useRef(0);

  const usableWidth = width - HANDLE_WIDTH * 2;

  function secondsToX(seconds: number) {
    if (totalDuration <= 0) return 0;
    return (seconds / totalDuration) * usableWidth;
  }

  function xToSeconds(x: number) {
    if (usableWidth <= 0) return 0;
    return (x / usableWidth) * totalDuration;
  }

  const startPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startGestureAnchorRef.current = secondsToX(startXRef.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextSeconds = xToSeconds(startGestureAnchorRef.current + gesture.dx);
          const clamped = Math.max(0, Math.min(nextSeconds, endXRef.current - MIN_TRIM_SECONDS));
          onChange({ startSeconds: clamped, endSeconds: endXRef.current });
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [totalDuration, usableWidth],
  );

  const endPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          endGestureAnchorRef.current = secondsToX(endXRef.current);
        },
        onPanResponderMove: (_event, gesture) => {
          const nextSeconds = xToSeconds(endGestureAnchorRef.current + gesture.dx);
          const clamped = Math.min(totalDuration, Math.max(nextSeconds, startXRef.current + MIN_TRIM_SECONDS));
          onChange({ startSeconds: startXRef.current, endSeconds: clamped });
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [totalDuration, usableWidth],
  );

  const startX = secondsToX(startSeconds);
  const endX = secondsToX(endSeconds);
  const frameWidth = tiles.length > 0 ? width / tiles.length : 0;

  return (
    <View style={[styles.container, { width }]}>
      <View style={styles.filmstrip}>
        {tiles.map((tile) => (
          <View key={tile.key} style={{ width: frameWidth, height: STRIP_HEIGHT }}>
            <Image
              source={tile.frame}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            {tile.dimmed ? <View style={styles.dimOverlay} /> : null}
          </View>
        ))}
        {isLoading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.textSecondary} size="small" />
          </View>
        ) : null}
      </View>
      <View
        style={[styles.handle, { left: startX }]}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        {...startPanResponder.panHandlers}
      >
        <View style={styles.handleInnerBar} />
      </View>
      <View
        style={[styles.handle, { left: endX + HANDLE_WIDTH }]}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        {...endPanResponder.panHandlers}
      >
        <View style={styles.handleInnerBar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: STRIP_HEIGHT,
    justifyContent: 'center',
  },
  filmstrip: {
    flexDirection: 'row',
    height: STRIP_HEIGHT,
    borderRadius: 10,
    backgroundColor: colors.mainColor,
    overflow: 'hidden',
  },
  dimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(156,163,175,0.55)',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    position: 'absolute',
    top: (STRIP_HEIGHT - HANDLE_HEIGHT) / 2,
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    borderRadius: 2,
    backgroundColor: colors.mainColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleInnerBar: {
    width: 2,
    height: 17,
    borderRadius: 30,
    backgroundColor: colors.bgColor,
  },
});
