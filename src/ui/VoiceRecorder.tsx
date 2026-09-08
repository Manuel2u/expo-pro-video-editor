import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Mic, Square } from 'lucide-react-native';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { tv } from 'tailwind-variants';

import { RecordingIndicator } from './RecordingIndicator';

const RECORDING_OPTIONS = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

const styles = {
  backdrop: tv({ base: 'flex-1 justify-end bg-black/45' }),
  sheet: tv({
    base: 'gap-4 rounded-t-2xl bg-white p-5 dark:bg-video-editor-surface',
  }),
  title: tv({ base: 'text-base font-semibold text-video-editor-text' }),
  errorText: tv({ base: 'text-center text-[13px] text-video-editor-text-muted' }),
  controlsRow: tv({ base: 'flex-row items-center justify-center gap-6 py-2' }),
  controlSpacer: tv({ base: 'w-10' }),
  recordButtonRing: tv({
    base: 'h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-video-editor-border',
    variants: { disabled: { true: 'opacity-50' } },
  }),
  recordCircle: tv({
    base: 'h-[60px] w-[60px] items-center justify-center rounded-full bg-video-editor-accent',
    variants: { disabled: { true: 'bg-video-editor-bar-unplayed' } },
  }),
  discardButton: tv({
    base: 'h-10 w-10 items-center justify-center rounded-full border-[0.5px] border-video-editor-border bg-video-editor-surface',
  }),
  discardButtonText: tv({ base: 'text-base text-video-editor-text' }),
  bottomBar: tv({ base: 'flex-row items-center justify-between' }),
  cancelText: tv({ base: 'text-sm text-video-editor-text' }),
  doneButton: tv({
    base: 'h-[38px] items-center justify-center rounded-full bg-video-editor-accent px-5',
    variants: { disabled: { true: 'opacity-40' } },
  }),
  doneButtonText: tv({ base: 'text-sm font-semibold text-white' }),
};

export type VoiceRecorderResult = {
  uri: string;
  durationSeconds: number;
};

/**
 * The container a `VoiceRecorder` presents in — defaults to a plain React
 * Native `Modal` rendered as a bottom sheet. Pass a real bottom-sheet
 * component (e.g. `@gorhom/bottom-sheet`'s `BottomSheetModal`, or a wrapper
 * like `@niibase/bottom-sheet-manager`'s `BottomSheet`) to get native sheet
 * behavior (drag-to-dismiss, snap points) instead — this package has no
 * opinion on which sheet library you use, and doesn't depend on one.
 */
export type VoiceRecorderContainer = ComponentType<{
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}>;

function DefaultContainer(props: { visible: boolean; onRequestClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onRequestClose}>
      <View className={styles.backdrop()}>{props.children}</View>
    </Modal>
  );
}

/**
 * A record/stop/discard/done voice recorder, presented as a bottom sheet.
 * Renders on top of whatever the caller passes as `backgroundContent` (e.g.
 * an editor's own video preview, kept alive and playing behind the sheet) —
 * or nothing, for a recorder with no visual context (e.g. a chat app).
 *
 * `progress`, if provided, drives a `RecordingIndicator` in `'filmstrip'`
 * mode (a video's own frames with a moving playhead) so the user can see a
 * fixed-length recording's end coming. Without it, the indicator falls back
 * to a live mic-amplitude waveform — no video required.
 */
export function VoiceRecorder(props: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (result: VoiceRecorderResult) => void;
  title?: string;
  width: number;
  backgroundContent?: ReactNode;
  /** Ties the recording indicator to a video's own playhead (filmstrip
   * mode) and auto-stops the take once the video reaches its end. Omit for
   * a plain live-amplitude waveform with no fixed end. */
  progress?: {
    videoUri: string | null;
    currentTime: number;
    totalDuration: number;
    /** Called every render while recording so the caller can drive its own
     * video player in lockstep (play on record, pause/rewind on
     * stop/discard) — this component has no video player of its own. */
    onPlaybackRequest: (action: 'play' | 'pause' | 'restart') => void;
  };
  /** Sheet container to present in — defaults to a plain `Modal`. */
  Container?: VoiceRecorderContainer;
}) {
  const { visible, onCancel, onConfirm, title = 'Voice-over', width, backgroundContent, progress, Container = DefaultContainer } = props;
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDurationSeconds, setRecordedDurationSeconds] = useState(0);
  /**
   * Where the filmstrip's played-overlay should freeze once a take is
   * stopped. The live `progress.currentTime` keeps moving after that — a
   * caller's own trim-preview effect may rewind its player once it reaches
   * the end — so the overlay needs its own frozen snapshot instead of
   * reading the live position, to stay put where the recording actually
   * ended.
   */
  const [frozenTime, setFrozenTime] = useState<number | null>(null);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    requestRecordingPermissionsAsync().then(async ({ granted }) => {
      if (cancelled) return;
      if (!granted) {
        setPermissionError('Microphone access is required to record.');
        return;
      }
      /**
       * The audio session defaults to `allowsRecording: false` — record()
       * rejects with RecordingDisabledException until this is set, even
       * with the OS permission already granted. `playsInSilentMode` keeps
       * any background playback and the mic recording both alive together
       * rather than one silencing the other.
       */
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    });

    return () => {
      cancelled = true;
    };
  }, [visible]);

  /**
   * Reset to a clean slate every time the sheet opens, computed during
   * render (not an effect) since this component stays mounted across
   * open/close rather than remounting.
   */
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setRecordedUri(null);
      setRecordedDurationSeconds(0);
      setFrozenTime(null);
    }
  }

  // Don't start playing anything until the user actually presses record.
  useEffect(() => {
    if (!visible) return;
    progress?.onPlaybackRequest('pause');
    progress?.onPlaybackRequest('restart');
  }, [visible]);

  async function stopRecording() {
    setFrozenTime(progress?.currentTime ?? 0);
    await recorder.stop();
    progress?.onPlaybackRequest('pause');
    setRecordedUri(recorder.uri);
    setRecordedDurationSeconds(recorderState.durationMillis / 1000);
  }

  async function handleToggleRecording() {
    if (recorderState.isRecording) {
      await stopRecording();
      return;
    }

    setRecordedUri(null);
    setFrozenTime(null);
    /**
     * Fully pause/rewind before asking AVAudioRecorder to prepare — starting
     * playback and preparing the recorder in the same tick can leave the two
     * contending for the audio session on-device ("Failed to prepare
     * recorder"). Only once the recorder is confirmed ready do both
     * playback and recording start together.
     */
    progress?.onPlaybackRequest('pause');
    progress?.onPlaybackRequest('restart');
    /**
     * Re-passing the preset (instead of calling prepareToRecordAsync() bare)
     * forces the native side to build a brand-new AVAudioRecorder at a fresh
     * file path every take. With no options, prepare() reuses the same
     * recorder instance from the previous take at its original file — after
     * a take had already been stopped once, re-preparing that same instance
     * produced a file with no audio data on the second take.
     */
    await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
    recorder.record();
    progress?.onPlaybackRequest('play');
  }

  /**
   * A fixed-length recording context (e.g. narrating over a video) auto-stops
   * the take once that context reaches its end, capping it at exactly one
   * pass instead of freezing progress without ever stopping the recording.
   */
  useEffect(() => {
    if (!visible || !progress || !recorderState.isRecording) return;
    if (progress.totalDuration > 0 && progress.currentTime >= progress.totalDuration - 0.05) {
      queueMicrotask(stopRecording);
    }
  }, [visible, recorderState.isRecording, progress?.currentTime, progress?.totalDuration]);

  function handleDiscard() {
    setRecordedUri(null);
    setRecordedDurationSeconds(0);
    setFrozenTime(null);
    progress?.onPlaybackRequest('restart');
    progress?.onPlaybackRequest('play');
  }

  function handleDone() {
    if (!recordedUri) return;
    onConfirm({ uri: recordedUri, durationSeconds: recordedDurationSeconds });
  }

  return (
    <Container visible={visible} onRequestClose={onCancel}>
      {backgroundContent}
      <View className={styles.sheet()}>
        <Text className={styles.title()}>{title}</Text>

        {permissionError ? <Text className={styles.errorText()}>{permissionError}</Text> : null}

        {progress ? (
          <RecordingIndicator
            mode="filmstrip"
            uri={progress.videoUri}
            durationSeconds={progress.totalDuration}
            currentTime={frozenTime ?? progress.currentTime}
            width={width}
          />
        ) : (
          <RecordingIndicator mode="waveform" metering={recorderState.metering} isRecording={recorderState.isRecording} width={width} />
        )}

        <View className={styles.controlsRow()}>
          {recordedUri ? (
            <>
              <View className={styles.controlSpacer()} />
              <RecordButton isRecording={false} disabled onPress={handleToggleRecording} />
              <TouchableOpacity className={styles.discardButton()} onPress={handleDiscard}>
                <Text className={styles.discardButtonText()}>✕</Text>
              </TouchableOpacity>
            </>
          ) : (
            <RecordButton isRecording={recorderState.isRecording} disabled={!!permissionError} onPress={handleToggleRecording} />
          )}
        </View>

        <View className={styles.bottomBar()}>
          <TouchableOpacity onPress={onCancel}>
            <Text className={styles.cancelText()}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity className={styles.doneButton({ disabled: !recordedUri })} onPress={handleDone} disabled={!recordedUri}>
            <Text className={styles.doneButtonText()}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Container>
  );
}

const ICON_COLOR = '#ffffff';

function RecordButton(props: { isRecording: boolean; disabled: boolean; onPress: () => void }) {
  const { isRecording, disabled, onPress } = props;
  return (
    <TouchableOpacity className={styles.recordButtonRing({ disabled })} onPress={onPress} disabled={disabled}>
      {isRecording ? (
        <View className={styles.recordCircle()}>
          <Square size={20} color={ICON_COLOR} fill={ICON_COLOR} />
        </View>
      ) : (
        <View className={styles.recordCircle({ disabled })}>
          <Mic size={26} color={ICON_COLOR} />
        </View>
      )}
    </TouchableOpacity>
  );
}
