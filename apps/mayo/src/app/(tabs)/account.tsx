import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, type ThemeMode } from '@/settings/settings';
import { type Lang } from '@/i18n/translations';
import { STORAGE, TIERS } from '@/mocks/data';

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
};

export default function AccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t, themeMode, setThemeMode, lang, setLang, defaultTierId, setDefaultTier } = useSettings();

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
    { icon: 'time-outline', label: t('account.retention'), value: t('account.retentionValue') },
    {
      icon: 'card-outline',
      label: t('account.billing'),
      value: t('account.billingValue'),
      onPress: () => router.push('/plan'),
    },
    { icon: 'settings-outline', label: t('account.preferences'), value: '' },
  ];

  return (
    <Screen title={t('tab.account')} subtitle={t('account.subtitle')}>
      <Pressable
        onPress={() => router.push('/plan')}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
        <ThemedView type="backgroundElement" style={styles.plan}>
          <View style={styles.planTop}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t('account.plan')}
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
          <ThemedText type="subtitle">Pro</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('account.planDesc')}
          </ThemedText>
        </ThemedView>
      </Pressable>

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

      <ThemedText type="smallBold">{t('account.defaultModel')}</ThemedText>
      <View style={styles.row}>
        {TIERS.map((tier) => (
          <Chip
            key={tier.id}
            label={tier.label}
            selected={defaultTierId === tier.id}
            onPress={() => setDefaultTier(tier.id)}
          />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('account.defaultModelHint')}
      </ThemedText>

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
          <Pressable
            key={r.label}
            onPress={r.onPress}
            disabled={!r.onPress}
            style={({ pressed }) => [
              styles.rowItem,
              i < rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.backgroundSelected,
              },
              pressed && r.onPress ? styles.pressed : undefined,
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
          </Pressable>
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
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
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
