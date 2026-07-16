import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

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

export function ErrorBlock({ onRetry }: { onRetry?: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
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
