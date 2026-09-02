import * as MediaLibrary from 'expo-media-library/legacy';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import UploadIcon from '../../assets/icons/upload.svg';
import { GalleryGrid } from '../../components/new-clip/gallery-grid';
import { colors } from '../../constants/colors';

const COLUMN_COUNT = 3;
const CELL_GAP = 1;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_WIDTH = (SCREEN_WIDTH - CELL_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
const CELL_HEIGHT = 180;

export default function NewClipScreen() {
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isResolvingAsset, setIsResolvingAsset] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<MediaLibrary.Asset[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        if (!cancelled) setPermissionError('Photo library access is required to pick a clip.');
        return;
      }

      const page = await MediaLibrary.getAssetsAsync({
        mediaType: 'video',
        first: 30,
        sortBy: 'creationTime',
      });
      if (!cancelled) setAssets(page.assets);
    }

    loadAssets();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleToggleAsset(asset: MediaLibrary.Asset) {
    setSelectedAssets((prev) => {
      const isSelected = prev.some((a) => a.id === asset.id);
      if (isSelected) return prev.filter((a) => a.id !== asset.id);
      return [...prev, asset];
    });
  }

  async function handleConfirmSelection() {
    // The render module opens each source with a plain filesystem path, so a
    // PHAsset reference (iOS's `ph://...` asset.uri) has to be resolved to a
    // real local file first — `localUri` is exactly that (unlike `uri`,
    // which `expo-video` can play directly but our own native module cannot
    // open).
    setIsResolvingAsset(true);
    try {
      const infos = await Promise.all(
        selectedAssets.map((asset) => MediaLibrary.getAssetInfoAsync(asset))
      );
      const uris = infos.map((info, index) => info.localUri ?? selectedAssets[index].uri);
      router.push({ pathname: '/new-clip/editor', params: { uris: JSON.stringify(uris) } });
    } finally {
      setIsResolvingAsset(false);
    }
  }

  function handlePressCamera() {
    router.push('/new-clip/camera');
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>New Clip</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleConfirmSelection}
          disabled={selectedAssets.length === 0}>
          <UploadIcon width={24} height={24} opacity={selectedAssets.length === 0 ? 0.35 : 1} />
        </TouchableOpacity>
      </View>
      {selectedAssets.length > 0 ? (
        <Text style={styles.selectionHint}>
          {selectedAssets.length} clip{selectedAssets.length === 1 ? '' : 's'} selected — tap the
          upload icon to continue
        </Text>
      ) : null}

      {permissionError ? (
        <View style={styles.centerMessage}>
          <Text style={styles.permissionText}>{permissionError}</Text>
        </View>
      ) : (
        <ScrollView>
          <GalleryGrid
            assets={assets}
            selectedIds={selectedAssets.map((a) => a.id)}
            onToggleAsset={handleToggleAsset}
            onPressCamera={handlePressCamera}
            cellWidth={CELL_WIDTH}
            cellHeight={CELL_HEIGHT}
          />
        </ScrollView>
      )}

      {isResolvingAsset ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.white} size="large" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgTertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  cancelText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  uploadButton: {
    height: 40,
    width: 40,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: colors.stroke,
    backgroundColor: colors.inputField,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionHint: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontSize: 12,
    color: colors.textSecondary,
  },
  centerMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
