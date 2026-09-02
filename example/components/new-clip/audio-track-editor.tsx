import * as MediaLibrary from 'expo-media-library/legacy';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../../constants/colors';

export type AudioTrackDraft = {
  path: string;
  name: string;
  durationSeconds: number;
};

/**
 * Lists device audio files and lets the user pick one to lay underneath the
 * video track — maps directly onto RenderConfig.audioTracks, which already
 * supports independent trim (audioStartUs/audioEndUs) and timeline placement
 * (startUs/endUs) for the picked file.
 */
export function AudioTrackEditor(props: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (draft: AudioTrackDraft) => void;
}) {
  const { visible, onCancel, onConfirm } = props;
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setPermissionError(null);
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setPermissionError('Audio library access is required to add a track.');
          return;
        }
        const page = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
          first: 50,
          sortBy: 'creationTime',
        });
        if (!cancelled) setAssets(page.assets);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function handleSelect(asset: MediaLibrary.Asset) {
    const info = await MediaLibrary.getAssetInfoAsync(asset);
    const path = info.localUri ?? asset.uri;
    onConfirm({ path, name: asset.filename, durationSeconds: asset.duration ?? 0 });
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Add audio</Text>

          {isLoading ? (
            <ActivityIndicator color={colors.textSecondary} style={styles.loader} />
          ) : permissionError ? (
            <Text style={styles.emptyText}>{permissionError}</Text>
          ) : assets.length === 0 ? (
            <Text style={styles.emptyText}>No audio files found on this device.</Text>
          ) : (
            <FlatList
              data={assets}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => handleSelect(item)}>
                  <Text style={styles.rowText} numberOfLines={1}>
                    {item.filename}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgTertiary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    gap: 14,
    maxHeight: '70%',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loader: {
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: 24,
    textAlign: 'center',
  },
  list: {
    maxHeight: 320,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.stroke,
  },
  rowText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  cancelButton: {
    height: 46,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
});
