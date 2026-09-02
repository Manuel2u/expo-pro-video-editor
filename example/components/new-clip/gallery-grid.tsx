import { Image } from 'expo-image';
import type * as MediaLibrary from 'expo-media-library/legacy';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import CameraIcon from '../../assets/icons/camera.svg';
import { colors } from '../../constants/colors';

const CELL_GAP = 1;
const SOURCE_LOAD_TIMEOUT_MS = 8000;

/**
 * `generateThumbnailsAsync` reads from "the currently played asset" — the
 * player has to finish loading the source's metadata first, which
 * `createVideoPlayer` does not wait for. Resolves once `sourceLoad` fires (or
 * rejects on timeout) so a thumbnail request right after construction doesn't
 * silently produce nothing.
 */
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

/** One decoded first-frame thumbnail per asset, generated once per asset list. */
function useVideoThumbnails(assets: MediaLibrary.Asset[]) {
  const [thumbnails, setThumbnails] = useState<Record<string, VideoThumbnail | null>>({});

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      const results = await Promise.all(
        assets.map(async (asset) => {
          const player = createVideoPlayer(asset.uri);
          try {
            await waitForSourceLoad(player);
            const [thumbnail] = await player.generateThumbnailsAsync(0);
            return { assetId: asset.id, thumbnail: thumbnail ?? null };
          } catch (error) {
            console.warn(`Thumbnail generation failed for ${asset.id}:`, error);
            return { assetId: asset.id, thumbnail: null };
          } finally {
            player.release();
          }
        }),
      );

      if (cancelled) return;
      setThumbnails((prev) => {
        const next = { ...prev };
        for (const result of results) {
          next[result.assetId] = result.thumbnail;
        }
        return next;
      });
    }

    generate();
    return () => {
      cancelled = true;
    };
  }, [assets]);

  return thumbnails;
}

export function GalleryGrid(props: {
  assets: MediaLibrary.Asset[];
  selectedIds: string[];
  onToggleAsset: (asset: MediaLibrary.Asset) => void;
  onPressCamera: () => void;
  cellWidth: number;
  cellHeight: number;
}) {
  const { assets, selectedIds, onToggleAsset, onPressCamera, cellWidth, cellHeight } = props;
  const thumbnails = useVideoThumbnails(assets);

  return (
    <View style={styles.grid}>
      <CameraCell width={cellWidth} height={cellHeight} onPress={onPressCamera} />
      {assets.map((asset) => {
        const selectionIndex = selectedIds.indexOf(asset.id);
        return (
          <AssetCell
            key={asset.id}
            thumbnail={thumbnails[asset.id] ?? null}
            width={cellWidth}
            height={cellHeight}
            selectionOrder={selectionIndex === -1 ? null : selectionIndex + 1}
            onPress={() => onToggleAsset(asset)}
          />
        );
      })}
    </View>
  );
}

function CameraCell(props: { width: number; height: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.cell, styles.cameraCellInner, { width: props.width, height: props.height, backgroundColor: colors.bgColor }]}
      onPress={props.onPress}
    >
      <View style={styles.cameraButtonGroup}>
        <View style={styles.cameraCircle}>
          <CameraIcon width={24} height={24} />
        </View>
        <Text style={styles.cameraLabel}>Camera</Text>
      </View>
    </TouchableOpacity>
  );
}

function AssetCell(props: {
  thumbnail: VideoThumbnail | null;
  width: number;
  height: number;
  selectionOrder: number | null;
  onPress: () => void;
}) {
  const { thumbnail, width, height, selectionOrder, onPress } = props;
  const isSelected = selectionOrder !== null;
  return (
    <TouchableOpacity
      style={[styles.cell, { width, height, backgroundColor: colors.neutral400 }]}
      onPress={onPress}
    >
      {thumbnail ? (
        <Image source={thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
        {isSelected ? <Text style={styles.selectionBadgeText}>{selectionOrder}</Text> : null}
      </View>
      {isSelected ? <View style={styles.selectedOverlay} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CELL_GAP,
  },
  cell: {
    overflow: 'hidden',
  },
  cameraCellInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButtonGroup: {
    alignItems: 'center',
    gap: 3,
  },
  cameraCircle: {
    height: 40,
    width: 40,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: colors.stroke,
    backgroundColor: colors.inputField,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLabel: {
    fontSize: 10,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  selectionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBadgeActive: {
    backgroundColor: colors.mainColor,
  },
  selectionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
});
