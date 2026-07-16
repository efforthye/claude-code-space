import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DURATIONS, TIERS, estimateCredits, formatDuration } from '@/mocks/data';

type Unit = 'sec' | 'min';

export default function CreateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [tierId, setTierId] = useState(TIERS[1].id);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<Unit>('min');

  const tier = useMemo(() => TIERS.find((t) => t.id === tierId) ?? TIERS[0], [tierId]);
  const credits = estimateCredits(seconds, tier);

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
    <Screen
      title="Create"
      subtitle="Describe it once — AI writes the script and directs the whole film.">
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Prompt</ThemedText>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="A cinematic short about a lighthouse keeper who discovers…"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.input, { color: theme.text }]}
        />
      </ThemedView>

      <ThemedText type="smallBold">Length</ThemedText>
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
        <Chip label="Custom" selected={customMode} onPress={() => setCustomMode(true)} />
      </View>

      {customMode ? (
        <ThemedView type="backgroundElement" style={styles.customBox}>
          <View style={styles.customRow}>
            <TextInput
              value={customValue}
              onChangeText={(v) => applyCustom(v, customUnit)}
              placeholder="e.g. 45"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              style={[styles.customInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <Chip label="sec" selected={customUnit === 'sec'} onPress={() => applyCustom(customValue, 'sec')} />
            <Chip label="min" selected={customUnit === 'min'} onPress={() => applyCustom(customValue, 'min')} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Any length — from 10 seconds to several hours.
          </ThemedText>
        </ThemedView>
      ) : null}

      <ThemedText type="smallBold">Quality &amp; model</ThemedText>
      <View style={styles.row}>
        {TIERS.map((t) => (
          <Chip key={t.id} label={t.label} selected={t.id === tierId} onPress={() => setTierId(t.id)} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {tier.blurb}
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.estimate}>
        <ThemedText type="small" themeColor="textSecondary">
          Estimated cost
        </ThemedText>
        <ThemedText type="subtitle">{credits} credits</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDuration(seconds)} · {tier.label} · exports the full film + every clip
        </ThemedText>
      </ThemedView>

      <Pressable
        onPress={() => router.push('/jobs')}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.text, opacity: pressed ? 0.85 : 1 },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          Generate my film
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
