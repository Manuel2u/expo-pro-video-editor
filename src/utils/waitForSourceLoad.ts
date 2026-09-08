import type { createVideoPlayer } from 'expo-video';

const SOURCE_LOAD_TIMEOUT_MS = 8000;

/** Resolves once `player`'s source has finished loading, or rejects after a timeout. */
export function waitForSourceLoad(player: ReturnType<typeof createVideoPlayer>): Promise<void> {
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
