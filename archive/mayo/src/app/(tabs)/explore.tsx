// Explore = the reels feed itself: a full-screen video pager. Browsing IS
// watching.
//
// Two lanes, because one feed cannot hold both shapes: a short in a landscape
// player is a strip between two black walls, and a wide film in a portrait one
// is a letterboxed sliver.
//
// Both lanes browse the same way — vertically, thumb up and down. The cinematic
// lane adds a 크게보기 control that turns the phone sideways and pages films
// one at a time, the way a video app goes fullscreen. Opening straight into
// landscape would force a rotation on someone who only wanted to look.
//
// The lane is switched by tapping the 탐색 tab you are already on — the same
// spare gesture other apps use to scroll a feed to the top — and by the visible
// toggle, since a hidden gesture is not a feature anyone finds.

import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ReelsFeed } from '@/explore/reels-feed';
import { useI18n } from '@/settings/settings';

type Lane = 'vertical' | 'horizontal';

export default function ExploreScreen() {
  const { t } = useI18n();
  const navigation = useNavigation();
  const [sort, setSort] = useState<'popular' | 'latest'>('popular');
  const [lane, setLane] = useState<Lane>('vertical');
  const flip = useCallback(() => setLane((l) => (l === 'vertical' ? 'horizontal' : 'vertical')), []);

  // Re-tapping the tab you are already on switches lane. preventDefault stops
  // the navigator also handling it as a navigation, which would remount the
  // feed and throw away your place in it.
  useEffect(() => {
    const unsub = navigation.addListener(
      // @ts-expect-error tabPress is a bottom-tabs event, absent from the base type
      'tabPress',
      (e: { preventDefault: () => void }) => {
        if (navigation.isFocused()) {
          e.preventDefault();
          flip();
        }
      },
    );
    return unsub;
  }, [navigation, flip]);

  return (
    <View style={styles.root}>
      <ReelsFeed
        mode={sort}
        orientation={lane}
        overlay={
          <SafeAreaView edges={['top']} style={styles.chipsWrap} pointerEvents="box-none">
            <View style={styles.chips}>
              {(['vertical', 'horizontal'] as const).map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLane(l)}
                  style={[styles.chip, lane === l && styles.chipActive]}>
                  <ThemedText
                    type="smallBold"
                    style={lane === l ? styles.chipTextActive : styles.chipText}>
                    {t(l === 'vertical' ? 'explore.lane.shorts' : 'explore.lane.cinema')}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <View style={styles.chips}>
              {(['popular', 'latest'] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setSort(s)}
                  style={[styles.chip, sort === s && styles.chipActive]}>
                  <ThemedText
                    type="smallBold"
                    style={sort === s ? styles.chipTextActive : styles.chipText}>
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
  chipsWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.one,
  },
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
