import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useSettings } from '@/settings/settings';
import { useJobs } from '@/store/jobs';
import { DURATIONS, TIERS, estimateCredits, formatDuration } from '@/mocks/data';

type Unit = 'sec' | 'min';

export default function CreateScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { defaultTierId } = useSettings();
  const router = useRouter();
  const { addJob } = useJobs();
  const [prompt, setPrompt] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [tierId, setTierId] = useState(defaultTierId);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<Unit>('min');

  const tier = useMemo(() => TIERS.find((x) => x.id === tierId) ?? TIERS[0], [tierId]);
  const credits = estimateCredits(seconds, tier);

  const generate = () => {
    const title = prompt.trim().split('\n')[0].slice(0, 60) || t('create.untitled');
    const id = addJob({ title, seconds, tierLabel: tier.label });
    router.push(`/jobs/${id}`);
  };

  const applyCustom = (raw: string, unit: Unit) => {
    const value = raw.replace(/[^0-9.]/g, '');
    setCustomValue(value);
    setCustomUnit(unit);
    const n = parseFloat(value);
    if (!Number.isNaN(n) && n > 0) {
      setSeconds(Math.max(1, Math.round(n * (unit === 'min' ? 60 : 1))));
    }
  };

  return (
    <Screen title={t('tab.create')} subtitle={t('create.subtitle')}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">{t('create.prompt')}</ThemedText>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder={t('create.promptPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.input, { color: theme.text }]}
        />
      </ThemedView>

      <ThemedText type="smallBold">{t('create.length')}</ThemedText>
      <View style={styles.row}>
        {DURATIONS.map((d) => (
          <Chip
            key={d.id}
            label={d.label}
            selected={!customMode && seconds === d.seconds}
            onPress={() => {
              setSeconds(d.seconds);
              setCustomMode(false);
            }}
          />
        ))}
        <Chip label={t('create.custom')} selected={customMode} onPress={() => setCustomMode(true)} />
      </View>

      {customMode ? (
        <ThemedView type="backgroundElement" style={styles.customBox}>
          <View style={styles.customRow}>
            <TextInput
              value={customValue}
              onChangeText={(v) => applyCustom(v, customUnit)}
              placeholder={t('create.customPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              style={[styles.customInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <Chip
              label={t('create.unitSec')}
              selected={customUnit === 'sec'}
              onPress={() => applyCustom(customValue, 'sec')}
            />
            <Chip
              label={t('create.unitMin')}
              selected={customUnit === 'min'}
              onPress={() => applyCustom(customValue, 'min')}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('create.customHint')}
          </ThemedText>
        </ThemedView>
      ) : null}

      <ThemedText type="smallBold">{t('create.quality')}</ThemedText>
      <View style={styles.row}>
        {TIERS.map((x) => (
          <Chip key={x.id} label={x.label} selected={x.id === tierId} onPress={() => setTierId(x.id)} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t(`tier.${tier.id}.blurb`)}
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.estimate}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('create.estimate')}
        </ThemedText>
        <ThemedText type="subtitle">{t('create.credits', { n: credits })}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('create.estimateMeta', { duration: formatDuration(seconds), tier: tier.label })}
        </ThemedText>
      </ThemedView>

      <Pressable
        onPress={generate}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.text, opacity: pressed ? 0.85 : 1 },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          {t('create.generate')}
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  input: {
    minHeight: 96,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  customBox: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  customInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  estimate: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  cta: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
});
