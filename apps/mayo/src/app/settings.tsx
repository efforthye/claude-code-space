import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TIERS } from '@/api/catalog';
import { getHealth, getMyKeys, getSettings, putMyKeys, putSettings } from '@/api/client';
import type { RuntimeSettings } from '@/api/types';
import { useAuth } from '@/auth/auth';
import { Chip } from '@/components/chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n, useSettings, type ThemeMode } from '@/settings/settings';
import { type Lang } from '@/i18n/translations';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const {
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
  const { user } = useAuth();

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

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Ionicons name="settings-outline" size={20} color={theme.text} />
            <ThemedText type="smallBold">{t('settings.title')}</ThemedText>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="smallBold">{t('account.appearance')}</ThemedText>
          <View style={styles.row}>
            {themeOptions.map((o) => (
              <Chip key={o.id} label={o.label} selected={themeMode === o.id} onPress={() => setThemeMode(o.id)} />
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
              <Chip key={tier.id} label={tier.label} selected={defaultTierId === tier.id} onPress={() => setDefaultTier(tier.id)} />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('account.defaultModelHint')}
          </ThemedText>

          <ThemedText type="smallBold">{t('account.generation')}</ThemedText>
          <View style={styles.row}>
            <Chip label={t('account.genFast')} selected={genBackend === 'mock'} onPress={() => chooseGen('mock')} />
            <Chip label={t('account.genLocal')} selected={genBackend === 'comfy'} onPress={() => chooseGen('comfy')} />
            <Chip label={t('account.genExternal')} selected={genBackend === 'external'} onPress={() => chooseGen('external')} />
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
            <Chip label={t('account.autoplayOff')} selected={!exploreAutoplay} onPress={() => setExploreAutoplay(false)} />
            <Chip label={t('account.autoplayOn')} selected={exploreAutoplay} onPress={() => setExploreAutoplay(true)} />
          </View>

          <ThemedText type="smallBold">{t('account.notify')}</ThemedText>
          <View style={styles.row}>
            <Chip label={t('account.notifyOff')} selected={!notifyOnDone} onPress={() => setNotifyOnDone(false)} />
            <Chip label={t('account.notifyOn')} selected={notifyOnDone} onPress={() => setNotifyOnDone(true)} />
          </View>

          <ThemedView type="backgroundElement" style={styles.serverCard}>
            <View style={styles.serverRow}>
              <View style={[styles.dot, { backgroundColor: online ? '#3BA55D' : '#E5484D' }]} />
              <ThemedText type="smallBold" style={styles.flex}>
                {t('account.server')} · {online ? t('account.serverConnected') : t('account.serverOffline')}
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
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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
      // keep quiet and let the user retry
    } finally {
      setSaving(false);
    }
  };

  const masked = status?.keys ?? {};
  const field = (value: string, onChange: (v: string) => void, placeholder: string, saved?: string) => (
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
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  serverCard: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.four },
  serverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  serverInput: {
    fontSize: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  keysCard: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.four },
  keyInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  keySave: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.four },
});
