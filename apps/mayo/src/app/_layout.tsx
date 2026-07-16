import { Stack } from 'expo-router';

import { ToastProvider } from '@/components/toast';
import { JobNotifier } from '@/notify/job-notifier';
import { PaymentsProvider } from '@/payments/context';
import { SettingsProvider } from '@/settings/settings';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <PaymentsProvider>
        <ToastProvider>
          <JobNotifier />
          <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="jobs/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="library/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="director" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
          <Stack.Screen name="extend" options={{ presentation: 'modal' }} />
          <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
          </Stack>
        </ToastProvider>
      </PaymentsProvider>
    </SettingsProvider>
  );
}
