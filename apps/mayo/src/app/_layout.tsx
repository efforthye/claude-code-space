import { Stack } from 'expo-router';

import { SettingsProvider } from '@/settings/settings';
import { JobsProvider } from '@/store/jobs';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <JobsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="jobs/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="library/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
          <Stack.Screen name="extend" options={{ presentation: 'modal' }} />
          <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
        </Stack>
      </JobsProvider>
    </SettingsProvider>
  );
}
