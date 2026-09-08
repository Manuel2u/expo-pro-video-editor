import { File, Paths } from 'expo-file-system';
import ExpoProVideoEditorModule from 'expo-pro-video-editor';
import type { RenderConfig } from 'expo-pro-video-editor';
import { router } from 'expo-router';
import { useState } from 'react';
import { Button, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Small, public, CC0 sample clip — used only to have a real local file to
 * hand to `render()` for this smoke test.
 */
const SAMPLE_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

type Status = { label: string; detail?: string };

export default function App() {
  const [status, setStatus] = useState<Status>({ label: 'idle' });
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [waveformStatus, setWaveformStatus] = useState<Status>({ label: 'idle' });
  const [waveformBusy, setWaveformBusy] = useState(false);

  async function runSmokeTest() {
    setBusy(true);
    setProgress(0);
    setStatus({ label: 'downloading sample video…' });

    const jobId = `smoke-${Date.now()}`;
    const subscription = ExpoProVideoEditorModule.addListener('onRenderProgress', event => {
      if (event.id === jobId) {
        setProgress(event.progress);
      }
    });

    try {
      const source = new File(Paths.cache, 'expo-pro-video-editor-smoke-source.mp4');
      if (source.exists) {
        source.delete();
      }
      const downloaded = await File.downloadFileAsync(SAMPLE_VIDEO_URL, source);

      setStatus({ label: 'rendering…' });

      /**
       * `RenderConfig.inputPath` is a plain filesystem path (it's handed straight
       * to `URL(fileURLWithPath:)` on the native side), not a `file://` URL —
       * strip the scheme that `File.uri` includes.
       */
      const inputPath = downloaded.uri.replace(/^file:\/\//, '');

      const config: RenderConfig = {
        videoClips: [
          {
            inputPath,
            startUs: 0,
            endUs: 3_000_000,
          },
        ],
        outputFormat: 'mp4',
        enableAudio: true,
      };

      const output = await ExpoProVideoEditorModule.render(config, jobId);
      const bytes = output?.byteLength ?? 0;
      setStatus({ label: 'success', detail: `${bytes} bytes` });
      subscription.remove();
      setBusy(false);
    } catch (error) {
      setStatus({ label: 'error', detail: String(error) });
      subscription.remove();
      setBusy(false);
    }
  }

  async function runWaveformSmokeTest() {
    setWaveformBusy(true);
    setWaveformStatus({ label: 'downloading sample video…' });

    try {
      const source = new File(Paths.cache, 'expo-pro-video-editor-smoke-source.mp4');
      if (!source.exists) {
        await File.downloadFileAsync(SAMPLE_VIDEO_URL, source);
      }

      setWaveformStatus({ label: 'extracting waveform…' });

      const inputPath = source.uri.replace(/^file:\/\//, '');
      const waveform = await ExpoProVideoEditorModule.extractWaveform(inputPath, 40);

      setWaveformStatus({
        label: 'success',
        detail: `${waveform.length} peaks, max=${Math.max(...waveform).toFixed(3)}`,
      });
      setWaveformBusy(false);
    } catch (error) {
      setWaveformStatus({ label: 'error', detail: String(error) });
      setWaveformBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Text style={styles.header}>expo-pro-video-editor</Text>
        <Group name="Render smoke test">
          <Text>Status: {status.label}</Text>
          {status.detail ? <Text>{status.detail}</Text> : null}
          {busy ? <Text>Progress: {Math.round(progress * 100)}%</Text> : null}
          <View style={styles.spacer} />
          <Button title="Download sample clip & render 3s trim" onPress={runSmokeTest} disabled={busy} />
        </Group>
        <Group name="Waveform smoke test">
          <Text>Status: {waveformStatus.label}</Text>
          {waveformStatus.detail ? <Text>{waveformStatus.detail}</Text> : null}
          <View style={styles.spacer} />
          <Button title="Extract waveform from sample clip" onPress={runWaveformSmokeTest} disabled={waveformBusy} />
        </Group>
        <Group name="Clip flow">
          <Text>Media picker → editor → post.</Text>
          <View style={styles.spacer} />
          <Button title="New Clip" onPress={() => router.push('/new-clip')} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  );
}

const styles = {
  header: { fontSize: 30, margin: 20 },
  groupHeader: { fontSize: 20, marginBottom: 20 },
  group: { margin: 20, backgroundColor: '#fff', borderRadius: 10, padding: 20 },
  container: { flex: 1, backgroundColor: '#eee' },
  view: { flex: 1, height: 200 },
  spacer: { height: 12 },
};
