import { Stack } from 'expo-router';

export default function NewClipLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="camera" />
      <Stack.Screen name="editor" options={{ gestureEnabled: false }} />
      <Stack.Screen name="post" />
    </Stack>
  );
}
