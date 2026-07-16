import { Stack } from 'expo-router';

import { AuthProvider } from '@/auth/auth';
import { ToastProvider } from '@/components/toast';
import { FavoritesProvider } from '@/explore/favorites';
import { FollowsProvider } from '@/explore/follows';
import { InboxProvider } from '@/notify/inbox';
import { JobNotifier } from '@/notify/job-notifier';
import { PaymentsProvider } from '@/payments/context';
import { SettingsProvider } from '@/settings/settings';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <PaymentsProvider>
          <FavoritesProvider>
            <FollowsProvider>
              <ToastProvider>
                <InboxProvider>
                <JobNotifier />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="jobs/[id]" options={{ presentation: 'card' }} />
                  <Stack.Screen name="library/[id]" options={{ presentation: 'card' }} />
                  <Stack.Screen name="reels" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
                  <Stack.Screen name="director" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="edit" options={{ presentation: 'fullScreenModal' }} />
                  <Stack.Screen name="login" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="notifications" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="publish" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="extend" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="plan" options={{ presentation: 'modal' }} />
                </Stack>
                </InboxProvider>
              </ToastProvider>
            </FollowsProvider>
          </FavoritesProvider>
        </PaymentsProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
