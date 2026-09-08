import { Image } from 'expo-image';
import type * as MediaLibrary from 'expo-media-library/legacy';
import { waitForSourceLoad } from 'expo-pro-video-editor';
import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import CameraIcon from '../../assets/icons/camera.svg';
import { colors } from '../../constants/colors';

const CELL_GAP = 1;

/** One decoded first-frame thumbnail per asset, generated once per asset list. */
function useVideoThumbnails(assets: MediaLibrary.Asset[]) {
  const [thumbnails, setThumbnails] = useState<Record<string, VideoThumbnail | null>>({});

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      const results = await Promise.all(
        assets.map(async asset => {
          const player = createVideoPlayer(asset.uri);
          let thumbnail: VideoThumbnail | null = null;
          try {
            await waitForSourceLoad(player);
            const generated = await player.generateThumbnailsAsync(0);
            if (generated[0]) {
              thumbnail = generated[0];
            }
          } catch (error) {
            console.warn(`Thumbnail generation failed for ${asset.id}:`, error);
          }
          player.release();
          return { assetId: asset.id, thumbnail };
        }),
      );

      if (cancelled) return;
      setThumbnails(prev => {
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
      {assets.map(asset => (
        <AssetCell
          key={asset.id}
          thumbnail={thumbnails[asset.id] ?? null}
          width={cellWidth}
          height={cellHeight}
          isSelected={selectedIds.includes(asset.id)}
          onPress={() => onToggleAsset(asset)}
        />
      ))}
    </View>
  );
}

function CameraCell(props: { width: number; height: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.cell, styles.cameraCellInner, { width: props.width, height: props.height, backgroundColor: colors.bgColor }]}
      onPress={props.onPress}>
      <View style={styles.cameraButtonGroup}>
        <View style={styles.cameraCircle}>
          <CameraIcon width={24} height={24} />
        </View>
        <Text style={styles.cameraLabel}>Camera</Text>
      </View>
    </TouchableOpacity>
  );
}

function AssetCell(props: { thumbnail: VideoThumbnail | null; width: number; height: number; isSelected: boolean; onPress: () => void }) {
  const { thumbnail, width, height, isSelected, onPress } = props;
  return (
    <TouchableOpacity style={[styles.cell, { width, height, backgroundColor: colors.neutral400 }]} onPress={onPress}>
      {thumbnail ? <Image source={thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={[styles.selectionBadge, isSelected && styles.selectionBadgeActive]}>
        {isSelected ? <Text style={styles.selectionBadgeText}>✓</Text> : null}
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
