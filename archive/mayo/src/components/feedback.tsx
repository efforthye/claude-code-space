import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { ApiError } from '@/api/client';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';

export function LoadingBlock() {
  const theme = useTheme();
  return (
    <View style={styles.block}>
      <ActivityIndicator color={theme.textSecondary} />
    </View>
  );
}

export function ErrorBlock({ onRetry, error }: { onRetry?: () => void; error?: Error | null }) {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  // 401 means "sign in", not "server down" — on the keyless public web build
  // every protected call is 401 until the visitor logs in. Say so.
  if (error instanceof ApiError && error.status === 401) {
    return (
      <View style={styles.block}>
        <Ionicons name="person-circle-outline" size={32} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {t('common.authNeeded')}
        </ThemedText>
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [
            styles.retry,
            { borderColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="log-in-outline" size={16} color={theme.text} />
          <ThemedText type="small">{t('auth.signIn')}</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Ionicons name="cloud-offline-outline" size={32} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {t('common.error')}
      </ThemedText>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retry,
            { borderColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="refresh" size={16} color={theme.text} />
          <ThemedText type="small">{t('common.retry')}</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  center: {
    textAlign: 'center',
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
