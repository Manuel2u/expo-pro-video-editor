import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors } from '../../constants/colors';

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!microphonePermission?.granted) requestMicrophonePermission();
  }, [
    cameraPermission,
    microphonePermission,
    requestCameraPermission,
    requestMicrophonePermission,
  ]);

  async function handleToggleRecording() {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      return;
    }

    setIsRecording(true);
    const result = await cameraRef.current?.recordAsync();
    setIsRecording(false);

    if (result?.uri) {
      router.replace({
        pathname: '/new-clip/editor',
        params: { uris: JSON.stringify([result.uri]) },
      });
    }
  }

  if (!cameraPermission?.granted || !microphonePermission?.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.permissionText}>
          Camera and microphone access are required to record a clip.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} mode="video" facing="back" />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={handleToggleRecording}>
            <View style={[styles.recordButton, isRecording && styles.recordButtonActive]} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionText: {
    color: colors.white,
    fontSize: 14,
    textAlign: 'center',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  cancelText: {
    fontSize: 14,
    color: colors.white,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  recordButton: {
    height: 72,
    width: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: colors.mainColor,
  },
  recordButtonActive: {
    borderRadius: 12,
    backgroundColor: '#ff0000',
  },
});
