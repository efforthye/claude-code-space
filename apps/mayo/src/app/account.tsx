import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, type ThemeMode } from '@/settings/settings';
import { type Lang } from '@/i18n/translations';
import { STORAGE } from '@/mocks/data';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string };

export default function AccountScreen() {
  const theme = useTheme();
  const { t, themeMode, setThemeMode, lang, setLang } = useSettings();

  const themeOptions: { id: ThemeMode; label: string }[] = [
    { id: 'system', label: t('theme.system') },
    { id: 'light', label: t('theme.light') },
    { id: 'dark', label: t('theme.dark') },
  ];
  const langOptions: { id: Lang; label: string }[] = [
    { id: 'system', label: t('lang.system') },
    { id: 'en', label: t('lang.en') },
    { id: 'ko', label: t('lang.ko') },
  ];
  const rows: Row[] = [
    { icon: 'sparkles-outline', label: t('account.defaultModel'), value: 'Standard' },
    { icon: 'time-outline', label: t('account.retention'), value: t('account.retentionValue') },
    { icon: 'card-outline', label: t('account.billing'), value: t('account.billingValue') },
    { icon: 'settings-outline', label: t('account.preferences'), value: '' },
  ];

  return (
    <Screen title={t('tab.account')} subtitle={t('account.subtitle')}>
      <ThemedView type="backgroundElement" style={styles.plan}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('account.plan')}
        </ThemedText>
        <ThemedText type="subtitle">Pro</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('account.planDesc')}
        </ThemedText>
      </ThemedView>

      <ThemedText type="smallBold">{t('account.appearance')}</ThemedText>
      <View style={styles.row}>
        {themeOptions.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            selected={themeMode === o.id}
            onPress={() => setThemeMode(o.id)}
          />
        ))}
      </View>

      <ThemedText type="smallBold">{t('account.language')}</ThemedText>
      <View style={styles.row}>
        {langOptions.map((o) => (
          <Chip key={o.id} label={o.label} selected={lang === o.id} onPress={() => setLang(o.id)} />
        ))}
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold">{t('account.storage')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {STORAGE.usedLabel} / {STORAGE.totalLabel}
          </ThemedText>
        </View>
        <ProgressBar value={STORAGE.usedRatio} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('account.storageHint')}
        </ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.rows}>
        {rows.map((r, i) => (
          <View
            key={r.label}
            style={[
              styles.rowItem,
              i < rows.length - 1 && {
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowLabel: {
    flex: 1,
  },
});
