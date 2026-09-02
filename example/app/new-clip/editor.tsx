import { useEvent } from 'expo';
import { File, Paths } from 'expo-file-system';
import ExpoProVideoEditorModule from 'expo-pro-video-editor';
import type { AudioTrack, ColorFilter, RenderConfig } from 'expo-pro-video-editor';
import { router, useLocalSearchParams } from 'expo-router';
import { createVideoPlayer, useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ArrowRightIcon from '../../assets/icons/arrow-right.svg';
import RedoIcon from '../../assets/icons/redo.svg';
import UndoIcon from '../../assets/icons/undo.svg';
import {
  AudioTrackEditor,
  type AudioTrackDraft,
} from '../../components/new-clip/audio-track-editor';
import { EditorToolbar, type EditorToolbarAction } from '../../components/new-clip/editor-toolbar';
import { TrimScrubber, type TimelineClip } from '../../components/new-clip/trim-scrubber';
import { colors } from '../../constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = 235;
const PREVIEW_HEIGHT = 358.824;
const SCRUBBER_WIDTH = SCREEN_WIDTH - 40;
const SOURCE_LOAD_TIMEOUT_MS = 8000;

const FILTER_PRESETS: {
  name: string;
  matrix: number[] | null;
  previewOverlayColor?: string;
}[] = [
  { name: 'None', matrix: null },
  {
    name: 'Grayscale',
    matrix: [0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0, 0, 1, 0],
  },
  {
    name: 'Warm',
    matrix: [1.1, 0, 0, 0, 10, 0, 1.0, 0, 0, 0, 0, 0, 0.85, 0, 0, 0, 0, 0, 1, 0],
    previewOverlayColor: 'rgba(255,159,64,0.18)',
  },
  {
    name: 'Cool',
    matrix: [0.9, 0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0, 1.15, 0, 10, 0, 0, 0, 1, 0],
    previewOverlayColor: 'rgba(64,159,255,0.18)',
  },
];

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

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

/** Resolves each clip's real duration up front so the merged timeline can be laid out proportionally. */
function useClipDurations(uris: string[]) {
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (uris.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClips([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    async function resolve() {
      setIsLoading(true);
      const results = await Promise.all(
        uris.map(async (uri) => {
          const player = createVideoPlayer(uri);
          try {
            await waitForSourceLoad(player);
            return { uri, durationSeconds: player.duration };
          } catch (error) {
            console.warn(`Duration resolution failed for ${uri}:`, error);
            return { uri, durationSeconds: 0 };
          } finally {
            player.release();
          }
        })
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

  return { clips, isLoading };
}

/** Strips `RenderConfig.inputPath`'s `file://` scheme and iOS's opaque PHAsset `#...` fragment. */
function toInputPath(uri: string) {
  return uri.replace(/^file:\/\//, '').replace(/#.*$/, '');
}

export default function EditorScreen() {
  const { uris: urisParam } = useLocalSearchParams<{ uris: string }>();
  const uris = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(urisParam ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [urisParam]);

  const { clips, isLoading: isResolvingClips } = useClipDurations(uris);
  const totalDuration = clips.reduce((sum, clip) => sum + clip.durationSeconds, 0);

  const [trimRange, setTrimRange] = useState({ startSeconds: 0, endSeconds: 0 });
  const [selectedFilter, setSelectedFilter] = useState<(typeof FILTER_PRESETS)[number]>(
    FILTER_PRESETS[0]
  );
  const [isFilterPickerOpen, setFilterPickerOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [audioTrack, setAudioTrack] = useState<AudioTrackDraft | null>(null);
  const [isAudioPickerOpen, setAudioPickerOpen] = useState(false);

  // Previewing the merged sequence: the first clip stands in for the
  // composited preview surface (a true multi-clip live preview would need
  // its own playlist player, out of scope for this pass — Next still
  // renders the real, fully merged composition).
  const previewUri = clips[0]?.uri;
  const player = useVideoPlayer(previewUri ?? null, (instance) => {
    instance.loop = false;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  useEffect(() => {
    if (totalDuration > 0 && trimRange.endSeconds === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrimRange({ startSeconds: 0, endSeconds: totalDuration });
    }
  }, [totalDuration, trimRange.endSeconds]);

  const effectiveEnd = trimRange.endSeconds > 0 ? trimRange.endSeconds : totalDuration;

  function handleTogglePlay() {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }

  function handleToolbarAction(action: EditorToolbarAction) {
    if (action === 'filter') {
      setFilterPickerOpen(true);
      return;
    }
    if (action === 'audio') {
      setAudioPickerOpen(true);
      return;
    }
    Alert.alert('Coming soon', `"${action}" isn't wired up in this example yet.`);
  }

  async function handleNext() {
    if (clips.length === 0) return;
    setIsRendering(true);

    const jobId = `editor-${Date.now()}`;

    const colorFilters: ColorFilter[] | undefined = selectedFilter.matrix
      ? [{ matrix: selectedFilter.matrix }]
      : undefined;

    const audioTracks: AudioTrack[] | undefined = audioTrack
      ? [
          {
            path: toInputPath(audioTrack.path),
            audioStartUs: 0,
            audioEndUs: Math.round(
              Math.min(audioTrack.durationSeconds || effectiveEnd, effectiveEnd) * 1_000_000
            ),
            startUs: 0,
          },
        ]
      : undefined;

    const config: RenderConfig = {
      videoClips: clips.map((clip) => ({ inputPath: toInputPath(clip.uri) })),
      colorFilters,
      audioTracks,
      outputFormat: 'mp4',
      enableAudio: true,
      startUs: Math.round(trimRange.startSeconds * 1_000_000),
      endUs: Math.round(effectiveEnd * 1_000_000),
    };

    try {
      const output = await ExpoProVideoEditorModule.render(config, jobId);
      if (!output) throw new Error('Render produced no output bytes');

      const outputFile = new File(Paths.cache, `new-clip-${jobId}.mp4`);
      outputFile.write(output);

      router.push({ pathname: '/new-clip/post', params: { uri: outputFile.uri } });
    } catch (error) {
      Alert.alert('Render failed', String(error));
    } finally {
      setIsRendering(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          disabled={isRendering || isResolvingClips}>
          {isRendering ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Text style={styles.nextText}>Next</Text>
              <ArrowRightIcon width={14} height={14} />
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.previewWrapper}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleTogglePlay}>
            <View style={styles.preview}>
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                nativeControls={false}
                contentFit="cover"
              />
              {selectedFilter.previewOverlayColor ? (
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFill,
                    styles.filterPreviewOverlay,
                    { backgroundColor: selectedFilter.previewOverlayColor },
                  ]}
                />
              ) : null}
              {selectedFilter.matrix ? (
                <View pointerEvents="none" style={styles.filterPreviewBadge}>
                  <Text style={styles.filterPreviewBadgeText}>{selectedFilter.name}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          <View style={styles.timeRow}>
            <TouchableOpacity onPress={handleTogglePlay}>
              <Text style={styles.playGlyph}>{isPlaying ? '⏸' : '▶'}</Text>
            </TouchableOpacity>
            <Text style={styles.timeText}>
              {formatTime(currentTime)}
              <Text style={styles.timeSeparator}> / </Text>
              {formatTime(totalDuration)}
            </Text>
            <View style={styles.undoRedoRow}>
              <UndoIcon width={24} height={24} />
              <RedoIcon width={24} height={24} />
            </View>
          </View>

          {isResolvingClips ? (
            <View style={[styles.scrubberLoading, { width: SCRUBBER_WIDTH }]}>
              <ActivityIndicator color={colors.textSecondary} size="small" />
            </View>
          ) : (
            <TrimScrubber
              clips={clips}
              width={SCRUBBER_WIDTH}
              startSeconds={trimRange.startSeconds}
              endSeconds={effectiveEnd}
              onChange={setTrimRange}
            />
          )}
        </View>

        {isFilterPickerOpen ? (
          <FilterPicker
            selected={selectedFilter}
            onSelect={(filter) => {
              setSelectedFilter(filter);
              setFilterPickerOpen(false);
            }}
          />
        ) : null}

        <View style={styles.addRow}>
          <TouchableOpacity style={styles.addPlaceholder} onPress={() => setAudioPickerOpen(true)}>
            <Text style={styles.addPlaceholderText}>
              {audioTrack ? audioTrack.name : '+ Add audio'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.toolbarContainer}>
        <EditorToolbar onPressAction={handleToolbarAction} />
      </View>

      <AudioTrackEditor
        visible={isAudioPickerOpen}
        onCancel={() => setAudioPickerOpen(false)}
        onConfirm={(draft) => {
          setAudioTrack(draft);
          setAudioPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function FilterPicker(props: {
  selected: (typeof FILTER_PRESETS)[number];
  onSelect: (filter: (typeof FILTER_PRESETS)[number]) => void;
}) {
  return (
    <ScrollView horizontal style={styles.filterRow} showsHorizontalScrollIndicator={false}>
      {FILTER_PRESETS.map((filter) => (
        <TouchableOpacity
          key={filter.name}
          style={[
            styles.filterChip,
            filter.name === props.selected.name && styles.filterChipSelected,
          ]}
          onPress={() => props.onSelect(filter)}>
          <Text style={styles.filterChipText}>{filter.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
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
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    minWidth: 76,
    paddingHorizontal: 15,
    borderRadius: 100,
    backgroundColor: colors.mainColor,
    justifyContent: 'center',
  },
  nextText: {
    color: colors.white,
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  previewWrapper: {
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 20,
  },
  preview: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    borderRadius: 13,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  filterPreviewOverlay: {
    borderRadius: 13,
  },
  filterPreviewBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  filterPreviewBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: SCRUBBER_WIDTH,
  },
  playGlyph: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  timeText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  timeSeparator: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  undoRedoRow: {
    flexDirection: 'row',
    gap: 9,
  },
  scrubberLoading: {
    height: 51,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    marginTop: 16,
    paddingLeft: 20,
  },
  filterChip: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  filterChipSelected: {
    borderColor: colors.mainColor,
    backgroundColor: colors.inputField,
  },
  filterChipText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  addRow: {
    marginTop: 16,
    paddingHorizontal: 20,
    gap: 6,
  },
  addPlaceholder: {
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  addPlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  toolbarContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: colors.stroke,
    backgroundColor: colors.bgSecondary,
  },
});
