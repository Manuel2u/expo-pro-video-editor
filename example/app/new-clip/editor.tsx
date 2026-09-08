import { useEvent } from 'expo';
import { File, Paths } from 'expo-file-system';
import ExpoProVideoEditorModule, {
  AudioTrimScrubber,
  AudioWaveform,
  TrimScrubber,
  useTimelineClips,
  VoiceRecorder,
  type AudioTrack,
  type ColorFilter,
  type RenderConfig,
} from 'expo-pro-video-editor';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArrowRightIcon from '../../assets/icons/arrow-right.svg';
import RedoIcon from '../../assets/icons/redo.svg';
import UndoIcon from '../../assets/icons/undo.svg';
import { AudioTrackEditor, type AudioTrackDraft } from '../../components/new-clip/audio-track-editor';
import { EditorToolbar, type EditorToolbarAction } from '../../components/new-clip/editor-toolbar';
import { colors } from '../../constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = 235;
const PREVIEW_HEIGHT = 358.824;
const SCRUBBER_WIDTH = SCREEN_WIDTH - 40;

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

/** Strips `RenderConfig.inputPath`'s `file://` scheme and iOS's opaque PHAsset `#...` fragment. */
function toInputPath(uri: string) {
  return uri.replace(/^file:\/\//, '').replace(/#.*$/, '');
}

export default function EditorScreen() {
  const insets = useSafeAreaInsets();
  const { uris: urisParam } = useLocalSearchParams<{ uris: string }>();
  const uris = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(urisParam ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [urisParam]);

  const { clips, isLoading: isResolvingClips } = useTimelineClips(uris);
  const totalDuration = clips.reduce((sum, clip) => sum + clip.durationSeconds, 0);

  const [trimRange, setTrimRange] = useState({ startSeconds: 0, endSeconds: 0 });
  const [selectedFilter, setSelectedFilter] = useState<(typeof FILTER_PRESETS)[number]>(FILTER_PRESETS[0]);
  const [isFilterPickerOpen, setFilterPickerOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [audioTrack, setAudioTrack] = useState<AudioTrackDraft | null>(null);
  const [audioTrimRange, setAudioTrimRange] = useState({ startSeconds: 0, endSeconds: 0 });
  const [isAudioPickerOpen, setAudioPickerOpen] = useState(false);
  const [isVoiceRecorderOpen, setVoiceRecorderOpen] = useState(false);
  const [isEmbeddedAudioRemoved, setEmbeddedAudioRemoved] = useState(false);

  /**
   * Previewing the merged sequence: the first clip stands in for the
   * composited preview surface (a true multi-clip live preview would need
   * its own playlist player, out of scope for this pass — Next still
   * renders the real, fully merged composition).
   */
  const previewUri = clips[0]?.uri;
  const player = useVideoPlayer(previewUri ?? null, instance => {
    instance.loop = false;
    /**
     * Default interval (0) emits `timeUpdate` too rarely to move the label
     * smoothly, especially over a short trim window.
     */
    instance.timeUpdateEventInterval = 0.1;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: player.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  /**
   * A second, headless (no VideoView attached) player just for the custom
   * audio track — expo-video has no API to attach an extra audio layer to
   * the video's own player, so this plays the file independently, driven in
   * lockstep with the video player wherever it's played/paused/seeked below.
   * This is a best-effort preview mix (two independently-clocked native
   * players can drift slightly); render() always produces the exact,
   * correctly mixed output regardless of any preview drift.
   */
  const audioPlayer = useVideoPlayer(audioTrack?.path ?? null, instance => {
    instance.loop = false;
  });
  const { isPlaying: isAudioPlaying } = useEvent(audioPlayer, 'playingChange', {
    isPlaying: audioPlayer.playing,
  });
  const { currentTime: audioCurrentTime } = useEvent(audioPlayer, 'timeUpdate', {
    currentTime: audioPlayer.currentTime,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
    bufferedPosition: 0,
  });

  /**
   * A newly selected clip may or may not have its own audio — reset the
   * removed flag so switching clips doesn't carry over a stale deletion.
   * Adjusted during render (not an effect) on previewUri's change.
   */
  const [previousPreviewUri, setPreviousPreviewUri] = useState(previewUri);
  if (previewUri !== previousPreviewUri) {
    setPreviousPreviewUri(previewUri);
    setEmbeddedAudioRemoved(false);
  }

  /**
   * Deleting the embedded-audio waveform should be heard immediately in the
   * live preview, not just reflected in the final render() config — muting
   * here keeps what's played back in sync with what render() will actually
   * produce (video sound + custom audio, or just custom audio once the
   * clip's own sound is removed).
   */
  useEffect(() => {
    player.muted = isEmbeddedAudioRemoved;
  }, [player, isEmbeddedAudioRemoved]);

  /**
   * The voice-recorder sheet drives this same shared player instead of
   * owning one itself — muted for the duration since its own audio sharing
   * the session with an active AVAudioRecorder is what causes
   * `prepareToRecordAsync` to fail with "Failed to prepare recorder".
   */
  useEffect(() => {
    if (!isVoiceRecorderOpen) return;
    player.muted = true;
    return () => {
      player.muted = isEmbeddedAudioRemoved;
    };
  }, [isVoiceRecorderOpen, player, isEmbeddedAudioRemoved]);

  function handleVoiceRecorderPlaybackRequest(action: 'play' | 'pause' | 'restart') {
    if (action === 'play') player.play();
    else if (action === 'pause') player.pause();
    else player.currentTime = 0;
  }

  /**
   * A newly picked custom audio track starts fully selected (its whole
   * duration), mirroring how the video's own trim range initializes.
   * Adjusted during render (not an effect) on audioTrack's change.
   */
  const [previousAudioTrack, setPreviousAudioTrack] = useState(audioTrack);
  if (audioTrack !== previousAudioTrack) {
    setPreviousAudioTrack(audioTrack);
    if (audioTrack) {
      setAudioTrimRange({ startSeconds: 0, endSeconds: audioTrack.durationSeconds });
    }
  }

  /**
   * Initializes the trim range to the clip's full duration once it resolves,
   * adjusted during render (not an effect) rather than after a paint.
   */
  if (totalDuration > 0 && trimRange.endSeconds === 0) {
    setTrimRange({ startSeconds: 0, endSeconds: totalDuration });
  }

  const effectiveEnd = trimRange.endSeconds > 0 ? trimRange.endSeconds : totalDuration;
  /**
   * Trust the player's own position — clamped into the trim range as a
   * safety net for the brief window before the re-clamp effect below
   * corrects a stale `currentTime` (e.g. right after dragging a handle).
   * This must NOT special-case `!isPlaying`: pausing mid-playback leaves a
   * perfectly valid `currentTime` that should keep being shown, not reset
   * to the trim start just because playback stopped.
   */
  const displayedCurrentTime = Math.min(Math.max(currentTime, trimRange.startSeconds), effectiveEnd);

  /**
   * Preview only the trimmed window, matching what render() will actually
   * produce — playback stops and rewinds to the trim start at the trim end
   * instead of running to the end of the source clip.
   */
  useEffect(() => {
    if (currentTime >= effectiveEnd) {
      player.pause();
      player.currentTime = trimRange.startSeconds;
      if (audioTrack) {
        audioPlayer.pause();
        audioPlayer.currentTime = audioTrimRange.startSeconds;
      }
    }
  }, [currentTime, effectiveEnd, player, trimRange.startSeconds, audioPlayer, audioTrack, audioTrimRange.startSeconds]);

  /**
   * Keeps the custom audio player positioned at the point in ITS OWN trim
   * range that corresponds to how far into the video's trim range playback
   * has gotten — e.g. a 30s audio trim under a 60s video trim plays that
   * 30s during the video's first half, then the audio player pauses (goes
   * quiet) while the video keeps playing for the second half. This is a
   * best-effort preview sync, not frame-exact (see the audioPlayer comment
   * above) — the final render() always mixes these precisely.
   */
  useEffect(() => {
    if (!audioTrack) return;
    const elapsedInVideo = currentTime - trimRange.startSeconds;
    const audioDuration = audioTrimRange.endSeconds - audioTrimRange.startSeconds;
    if (elapsedInVideo < 0 || elapsedInVideo >= audioDuration) {
      if (audioPlayer.playing) audioPlayer.pause();
      return;
    }
    if (isPlaying && !audioPlayer.playing) {
      audioPlayer.currentTime = audioTrimRange.startSeconds + elapsedInVideo;
      audioPlayer.play();
    } else if (!isPlaying && audioPlayer.playing) {
      audioPlayer.pause();
    }
  }, [audioTrack, audioPlayer, isPlaying, currentTime, trimRange.startSeconds, audioTrimRange.startSeconds, audioTrimRange.endSeconds]);

  /**
   * Dragging a handle past the current playhead should keep the preview
   * inside the selected window rather than silently playing outside it.
   */
  useEffect(() => {
    if (currentTime < trimRange.startSeconds || currentTime > effectiveEnd) {
      player.currentTime = trimRange.startSeconds;
    }
    // Only the range bounds should trigger a re-clamp, not every playback tick.
  }, [trimRange.startSeconds, effectiveEnd, player]);

  function handleTogglePlay() {
    if (isPlaying) {
      player.pause();
      return;
    }
    if (currentTime < trimRange.startSeconds || currentTime >= effectiveEnd) {
      player.currentTime = trimRange.startSeconds;
    }
    player.play();
  }

  function handleToolbarAction(action: EditorToolbarAction) {
    if (action === 'filter') {
      setFilterPickerOpen(true);
      return;
    }
    if (action === 'voice') {
      setVoiceRecorderOpen(true);
      return;
    }
    /**
     * 'audio' (toolbar music-note button) is reserved for a future sheet of
     * free cloud-hosted tracks — picking a file from the device is the "+
     * Add audio" placeholder below the scrubber, not this button.
     */
    Alert.alert('Coming soon', `"${action}" isn't wired up in this example yet.`);
  }

  async function handleNext() {
    if (clips.length === 0) return;
    setIsRendering(true);

    const jobId = `editor-${Date.now()}`;

    const colorFilters: ColorFilter[] | undefined = selectedFilter.matrix ? [{ matrix: selectedFilter.matrix }] : undefined;

    const audioTracks: AudioTrack[] | undefined = audioTrack
      ? [
          {
            path: toInputPath(audioTrack.path),
            audioStartUs: Math.round(audioTrimRange.startSeconds * 1_000_000),
            audioEndUs: Math.round(audioTrimRange.endSeconds * 1_000_000),
            startUs: 0,
          },
        ]
      : undefined;

    const config: RenderConfig = {
      videoClips: clips.map(clip => ({
        inputPath: toInputPath(clip.uri),
        /**
         * `volume: 0` drops the clip's own audio track from the render
         * entirely (not just silences it) — set once the user deletes the
         * embedded-audio waveform row.
         */
        volume: isEmbeddedAudioRemoved ? 0 : undefined,
      })),
      colorFilters,
      audioTracks,
      outputFormat: 'mp4',
      enableAudio: true,
      startUs: Math.round(trimRange.startSeconds * 1_000_000),
      endUs: Math.round(effectiveEnd * 1_000_000),
    };

    try {
      const output = await ExpoProVideoEditorModule.render(config, jobId);
      if (!output) {
        setIsRendering(false);
        Alert.alert('Render failed', 'Render produced no output bytes');
        return;
      }

      const outputFile = new File(Paths.cache, `new-clip-${jobId}.mp4`);
      outputFile.write(output);

      setIsRendering(false);
      router.push({ pathname: '/new-clip/post', params: { uri: outputFile.uri } });
    } catch (error) {
      setIsRendering(false);
      Alert.alert('Render failed', String(error));
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} disabled={isRendering || isResolvingClips}>
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
              <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="cover" />
              {selectedFilter.previewOverlayColor ? (
                <View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.filterPreviewOverlay, { backgroundColor: selectedFilter.previewOverlayColor }]}
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
              {formatTime(displayedCurrentTime)}
              <Text style={styles.timeSeparator}> / </Text>
              {formatTime(effectiveEnd)}
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

          {!isEmbeddedAudioRemoved && previewUri ? (
            <AudioWaveform
              inputPath={toInputPath(previewUri)}
              width={SCRUBBER_WIDTH}
              currentTime={displayedCurrentTime}
              startSeconds={trimRange.startSeconds}
              endSeconds={effectiveEnd}
              onDelete={() => setEmbeddedAudioRemoved(true)}
            />
          ) : null}
        </View>

        {isFilterPickerOpen ? (
          <FilterPicker
            selected={selectedFilter}
            onSelect={filter => {
              setSelectedFilter(filter);
              setFilterPickerOpen(false);
            }}
          />
        ) : null}

        <View style={styles.addRow}>
          {audioTrack ? (
            <AudioTrimScrubber
              inputPath={toInputPath(audioTrack.path)}
              durationSeconds={audioTrack.durationSeconds}
              startSeconds={audioTrimRange.startSeconds}
              endSeconds={audioTrimRange.endSeconds}
              currentTime={isAudioPlaying ? audioCurrentTime : null}
              onChange={setAudioTrimRange}
              onDelete={() => setAudioTrack(null)}
              width={SCRUBBER_WIDTH}
            />
          ) : (
            <TouchableOpacity style={styles.addPlaceholder} onPress={() => setAudioPickerOpen(true)}>
              <Text style={styles.addPlaceholderText}>+ Add audio</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <View style={[styles.toolbarContainer, { paddingBottom: insets.bottom }]}>
        <EditorToolbar onPressAction={handleToolbarAction} />
      </View>

      <AudioTrackEditor
        visible={isAudioPickerOpen}
        onCancel={() => setAudioPickerOpen(false)}
        onConfirm={draft => {
          setAudioTrack(draft);
          setAudioPickerOpen(false);
        }}
      />

      <VoiceRecorder
        visible={isVoiceRecorderOpen}
        width={SCRUBBER_WIDTH}
        progress={{
          videoUri: previewUri ?? null,
          currentTime,
          totalDuration,
          onPlaybackRequest: handleVoiceRecorderPlaybackRequest,
        }}
        onCancel={() => setVoiceRecorderOpen(false)}
        onConfirm={result => {
          setAudioTrack({ path: result.uri, name: 'Voice-over', durationSeconds: result.durationSeconds });
          setVoiceRecorderOpen(false);
        }}
      />
    </View>
  );
}

function FilterPicker(props: { selected: (typeof FILTER_PRESETS)[number]; onSelect: (filter: (typeof FILTER_PRESETS)[number]) => void }) {
  return (
    <ScrollView horizontal style={styles.filterRow} showsHorizontalScrollIndicator={false}>
      {FILTER_PRESETS.map(filter => (
        <TouchableOpacity
          key={filter.name}
          style={[styles.filterChip, filter.name === props.selected.name && styles.filterChipSelected]}
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
