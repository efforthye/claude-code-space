import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { STORAGE } from '@/mocks/data';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string };
const ROWS: Row[] = [
  { icon: 'sparkles-outline', label: 'Default model', value: 'Standard' },
  { icon: 'time-outline', label: 'Retention', value: '14 days' },
  { icon: 'card-outline', label: 'Billing', value: 'Manage' },
  { icon: 'settings-outline', label: 'Preferences', value: '' },
];

export default function AccountScreen() {
  const theme = useTheme();
  return (
    <Screen title="Account" subtitle="Your plan, storage, and generation preferences.">
      <ThemedView type="backgroundElement" style={styles.plan}>
        <ThemedText type="small" themeColor="textSecondary">
          Current plan
        </ThemedText>
        <ThemedText type="subtitle">Pro</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Longer retention · premium models · priority queue
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold">Storage</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {STORAGE.usedLabel} / {STORAGE.totalLabel}
          </ThemedText>
        </View>
        <ProgressBar value={STORAGE.usedRatio} />
        <ThemedText type="small" themeColor="textSecondary">
          Extend retention to keep videos beyond the default window.
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.rows}>
        {ROWS.map((r, i) => (
          <View
            key={r.label}
            style={[
              styles.row,
              i < ROWS.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.backgroundSelected,
              },
            ]}>
            <Ionicons name={r.icon} size={18} color={theme.textSecondary} />
            <ThemedText type="small" style={styles.rowLabel}>
              {r.label}
            </ThemedText>
            {r.value ? (
              <ThemedText type="small" themeColor="textSecondary">
                {r.value}
              </ThemedText>
            ) : null}
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
        ))}
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plan: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rows: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowLabel: {
    flex: 1,
  },
});
