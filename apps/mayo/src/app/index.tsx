import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DURATIONS, TIERS, estimateCredits } from '@/mocks/data';

export default function CreateScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [durationId, setDurationId] = useState(DURATIONS[1].id);
  const [tierId, setTierId] = useState(TIERS[1].id);

  const duration = useMemo(
    () => DURATIONS.find((d) => d.id === durationId) ?? DURATIONS[0],
    [durationId],
  );
  const tier = useMemo(() => TIERS.find((t) => t.id === tierId) ?? TIERS[0], [tierId]);
  const credits = estimateCredits(duration.minutes, tier);

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
            selected={d.id === durationId}
            onPress={() => setDurationId(d.id)}
          />
        ))}
      </View>

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
          {duration.label} · {tier.label} · exports the full film + every clip
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
