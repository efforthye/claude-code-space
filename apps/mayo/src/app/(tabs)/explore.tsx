// Explore = the reels feed itself (IG Reels-style, per owner request): a full-
// screen vertical video pager with a floating sort toggle. The old card grid is
// gone — browsing IS watching.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ReelsFeed } from '@/explore/reels-feed';
import { useI18n } from '@/settings/settings';

export default function ExploreScreen() {
  const { t } = useI18n();
  const [sort, setSort] = useState<'popular' | 'latest'>('popular');

  return (
    <View style={styles.root}>
      <ReelsFeed
        mode={sort}
        seedable
        overlay={
          <SafeAreaView edges={['top']} style={styles.chipsWrap} pointerEvents="box-none">
            <View style={styles.chips}>
              {(['popular', 'latest'] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSort(s)}
                  style={[styles.chip, sort === s && styles.chipActive]}>
                  <ThemedText type="smallBold" style={sort === s ? styles.chipTextActive : styles.chipText}>
                    {t(`explore.${s}`)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </SafeAreaView>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  chipsWrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  chips: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: Spacing.five,
    padding: 4,
  },
  chip: {
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.five,
  },
  chipActive: { backgroundColor: 'rgba(255,255,255,0.92)' },
  chipText: { color: '#ffffff' },
  chipTextActive: { color: '#000000' },
});
