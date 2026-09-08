import { createVideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';

import type { TimelineClip } from '../ui/TrimScrubber';
import { waitForSourceLoad } from '../utils/waitForSourceLoad';

/**
 * Resolves each URI's real duration, producing the `TimelineClip[]` shape
 * `TrimScrubber` expects. Handles a source that fails to load by falling
 * back to `durationSeconds: 0` for that clip rather than rejecting the
 * whole batch.
 */
export function useTimelineClips(uris: string[]): { clips: TimelineClip[]; isLoading: boolean } {
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (uris.length === 0) return;
    let cancelled = false;

    async function resolve() {
      setIsLoading(true);
      const results = await Promise.all(
        uris.map(async (uri): Promise<TimelineClip> => {
          const player = createVideoPlayer(uri);
          try {
            await waitForSourceLoad(player);
            const durationSeconds = player.duration;
            player.release();
            return { uri, durationSeconds };
          } catch (error) {
            console.warn(`Duration resolution failed for ${uri}:`, error);
            player.release();
            return { uri, durationSeconds: 0 };
          }
        }),
      );
      if (!cancelled) {
        setClips(results);
        setIsLoading(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [uris.join('|')]);

  if (uris.length === 0 && clips.length > 0) {
    setClips([]);
  }

  return { clips, isLoading: uris.length === 0 ? false : isLoading };
}
