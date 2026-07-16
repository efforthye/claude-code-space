import { Stack } from 'expo-router';

import { SettingsProvider } from '@/settings/settings';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="library/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
      </Stack>
    </SettingsProvider>
  );
}
