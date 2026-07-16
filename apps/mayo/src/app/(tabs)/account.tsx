import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useState } from 'react';

import { TIERS } from '@/api/catalog';
import { getHealth, getMyKeys, getSettings, getStorage, putMyKeys, putSettings } from '@/api/client';
import type { RuntimeSettings } from '@/api/types';
import { useAuth } from '@/auth/auth';
import { Chip } from '@/components/chip';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { usePayments } from '@/payments/context';
import { useI18n, useSettings, type ThemeMode } from '@/settings/settings';
import { type Lang } from '@/i18n/translations';

type Row = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
};

export default function AccountScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    t,
    themeMode,
    setThemeMode,
    lang,
    setLang,
    defaultTierId,
    setDefaultTier,
    apiUrl,
    setApiUrl,
    apiKey,
    setApiKey,
    exploreAutoplay,
    setExploreAutoplay,
    notifyOnDone,
    setNotifyOnDone,
  } = useSettings();
  const { data: storage } = useQuery(getStorage);
  const { data: health, error: healthError } = useQuery(getHealth, {
    pollMs: 10000,
    deps: [apiUrl],
  });
  const { data: genSettings } = useQuery(getSettings, { deps: [apiUrl] });
  const [genOverride, setGenOverride] = useState<string | null>(null);
  const [byokOverride, setByokOverride] = useState<boolean | null>(null);
  const genBackend = genOverride ?? genSettings?.generationBackend ?? 'mock';
  const byok = byokOverride ?? genSettings?.byok ?? false;
  // Always send the full settings object so flipping one control never resets
  // the others (the director backend/model live in the same runtime settings).
  const saveSettings = (patch: Partial<RuntimeSettings>) =>
    putSettings({
      generationBackend: genBackend,
      plannerBackend: genSettings?.plannerBackend,
      directorModel: genSettings?.directorModel,
      byok,
      ...patch,
    });
  const chooseGen = async (backend: string) => {
    setGenOverride(backend);
    try {
      await saveSettings({ generationBackend: backend });
    } catch {
      setGenOverride(genSettings?.generationBackend ?? 'mock');
    }
  };
  const chooseByok = async (value: boolean) => {
    setByokOverride(value);
    try {
      await saveSettings({ byok: value });
    } catch {
      setByokOverride(genSettings?.byok ?? false);
    }
  };
  const { entitlement } = usePayments();
  const { user, signOut } = useAuth();

  const online = !!health && health.status === 'ok' && !healthError;

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
      {user ? (
        <ThemedView type="backgroundElement" style={styles.authCard}>
          <Ionicons name="person-circle" size={36} color={theme.text} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">{user.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {user.email} · {user.provider === 'google' ? 'Google' : t('auth.emailProvider')}
            </ThemedText>
          </View>
          <Pressable onPress={signOut} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.signOut}>
              {t('auth.signOut')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        <Pressable onPress={() => router.push('/login')}>
          <ThemedView type="backgroundElement" style={styles.authCard}>
            <Ionicons name="person-circle-outline" size={36} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t('auth.signIn')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('auth.signInHint')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </ThemedView>
        </Pressable>
      )}

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
          <ThemedText type="subtitle">{t(`plan.${entitlement.planId}.name`)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(`plan.${entitlement.planId}.tagline`)}
          </ThemedText>
        </ThemedView>
      </Pressable>

      <ThemedView type="backgroundElement" style={styles.serverCard}>
        <View style={styles.serverRow}>
          <View style={[styles.dot, { backgroundColor: online ? '#3BA55D' : '#E5484D' }]} />
          <ThemedText type="smallBold" style={styles.flex}>
            {t('account.server')} ·{' '}
            {online ? t('account.serverConnected') : t('account.serverOffline')}
          </ThemedText>
        </View>
        <TextInput
          value={apiUrl}
          onChangeText={setApiUrl}
          placeholder="https://…"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.serverInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={t('account.apiKey')}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[styles.serverInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {t('account.serverHint')}
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

      <ThemedText type="smallBold">{t('account.generation')}</ThemedText>
      <View style={styles.row}>
        <Chip
          label={t('account.genFast')}
          selected={genBackend === 'mock'}
          onPress={() => chooseGen('mock')}
        />
        <Chip
          label={t('account.genLocal')}
          selected={genBackend === 'comfy'}
          onPress={() => chooseGen('comfy')}
        />
        <Chip
          label={t('account.genExternal')}
          selected={genBackend === 'external'}
          onPress={() => chooseGen('external')}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {genBackend === 'comfy'
          ? t('account.genLocalHint')
          : genBackend === 'external'
            ? t('account.genExternalHint')
            : t('account.genFastHint')}
      </ThemedText>

      <ThemedText type="smallBold">{t('account.byok')}</ThemedText>
      <View style={styles.row}>
        <Chip label={t('account.byokOff')} selected={!byok} onPress={() => chooseByok(false)} />
        <Chip label={t('account.byokOn')} selected={byok} onPress={() => chooseByok(true)} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('account.byokHint')}
      </ThemedText>
      {user ? <ByokKeysCard /> : null}

      <ThemedText type="smallBold">{t('account.autoplay')}</ThemedText>
      <View style={styles.row}>
        <Chip
          label={t('account.autoplayOff')}
          selected={!exploreAutoplay}
          onPress={() => setExploreAutoplay(false)}
        />
        <Chip
          label={t('account.autoplayOn')}
          selected={exploreAutoplay}
          onPress={() => setExploreAutoplay(true)}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('account.autoplayHint')}
      </ThemedText>

      <ThemedText type="smallBold">{t('account.notify')}</ThemedText>
      <View style={styles.row}>
        <Chip
          label={t('account.notifyOff')}
          selected={!notifyOnDone}
          onPress={() => setNotifyOnDone(false)}
        />
        <Chip
          label={t('account.notifyOn')}
          selected={notifyOnDone}
          onPress={() => setNotifyOnDone(true)}
        />
      </View>

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold">{t('account.storage')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {storage ? `${storage.usedLabel} / ${storage.totalLabel}` : '—'}
          </ThemedText>
        </View>
        <ProgressBar value={storage?.usedRatio ?? 0} />
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

/** Per-account BYOK provider keys. Values are write-only — the server returns a
 * masked tail ("…1234"), never the stored key. Saving any key gives BYOK pricing. */
function ByokKeysCard() {
  const theme = useTheme();
  const { t } = useI18n();
  const { data: status, refetch } = useQuery(getMyKeys);
  const [anthropic, setAnthropic] = useState('');
  const [higgsfield, setHiggsfield] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const save = async () => {
    if (saving || (!anthropic.trim() && !higgsfield.trim())) return;
    setSaving(true);
    try {
      await putMyKeys({
        ...(anthropic.trim() ? { anthropic: anthropic.trim() } : {}),
        ...(higgsfield.trim() ? { higgsfield: higgsfield.trim() } : {}),
      });
      setAnthropic('');
      setHiggsfield('');
      setSavedMsg(true);
      refetch();
    } catch {
      // toast lives above; keep quiet and let the user retry
    } finally {
      setSaving(false);
    }
  };

  const masked = status?.keys ?? {};
  const field = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    saved?: string,
  ) => (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={saved ? `${placeholder} (${t('account.keySaved')} ${saved})` : placeholder}
      placeholderTextColor={theme.textSecondary}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry
      style={[styles.keyInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
    />
  );

  return (
    <ThemedView type="backgroundElement" style={styles.keysCard}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('account.myKeysHint')}
      </ThemedText>
      {field(anthropic, setAnthropic, 'Anthropic (sk-ant-…)', masked.anthropic)}
      {field(higgsfield, setHiggsfield, 'Higgsfield (id:secret)', masked.higgsfield)}
      <Pressable
        onPress={save}
        disabled={saving || (!anthropic.trim() && !higgsfield.trim())}
        style={({ pressed }) => [
          styles.keySave,
          {
            backgroundColor: theme.text,
            opacity: saving || (!anthropic.trim() && !higgsfield.trim()) ? 0.4 : pressed ? 0.8 : 1,
          },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          {saving ? t('account.keySaving') : savedMsg ? t('account.keySavedDone') : t('account.keySaveBtn')}
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  keysCard: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.four },
  keyInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  keySave: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  authCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  signOut: { textDecorationLine: 'underline' },
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
  serverCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  serverInput: {
    fontSize: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
