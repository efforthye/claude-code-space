import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { STORAGE, VIDEOS } from '@/mocks/data';

export default function LibraryScreen() {
  const theme = useTheme();
  return (
    <Screen
      title="Library"
      subtitle="Finished videos are kept for a limited time. Download or extend before they expire.">
      <ThemedView type="backgroundElement" style={styles.storage}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold">Storage</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {STORAGE.usedLabel} / {STORAGE.totalLabel}
          </ThemedText>
        </View>
        <ProgressBar value={STORAGE.usedRatio} />
      </ThemedView>

      {VIDEOS.map((v) => (
        <ThemedView key={v.id} type="backgroundElement" style={styles.card}>
          <View style={[styles.thumb, { backgroundColor: v.accent }]}>
            <Ionicons name="play" size={20} color="#ffffff" />
          </View>
          <View style={styles.meta}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {v.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {v.durationLabel} · {v.sizeLabel}
            </ThemedText>
            <ThemedText type="small" themeColor={v.expiresInDays <= 3 ? 'text' : 'textSecondary'}>
              {v.expiresInDays <= 0
                ? 'Expired'
                : `Expires in ${v.expiresInDays} day${v.expiresInDays === 1 ? '' : 's'}`}
            </ThemedText>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel="Publish to YouTube"
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
              <Ionicons name="logo-youtube" size={22} color="#FF0000" />
            </Pressable>
            <Pressable
              accessibilityLabel="Download"
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
              <Ionicons name="download-outline" size={22} color={theme.text} />
            </Pressable>
          </View>
        </ThemedView>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  storage: {
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
