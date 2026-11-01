import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getExplore, publicReelThumbUrl } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFollows } from '@/explore/follows';
import { isVertical } from '@/explore/reels-feed';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';
import type { ExploreItem } from '@/api/types';

/**
 * A creator's public page: everything they have published, and one follow
 * button.
 *
 * Reached by tapping the handle on a reel. Without it the handle is decoration
 * — you can see who made something but not what else they made, which is the
 * only question that handle raises.
 */
export default function CreatorScreen() {
  const { author: raw } = useLocalSearchParams<{ author: string }>();
  const author = decodeURIComponent(String(raw ?? ''));
  const { t } = useI18n();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { isFollowing, toggle } = useFollows();

  const load = useCallback(() => getExplore('latest', 'all', author), [author]);
  const { data: items, refetch } = useQuery<ExploreItem[]>(load, { deps: [author] });
  const films = items ?? [];

  // Three across on a phone, more as the window grows — the grid is the point
  // of this screen, so it should use whatever width it is given.
  const columns = Math.max(3, Math.min(6, Math.floor(width / 180)));
  const gap = Spacing.one;
  const tile = (Math.min(width, 1100) - Spacing.screen * 2 - gap * (columns - 1)) / columns;
  const following = isFollowing(author);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
            {author}
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.body} onScrollBeginDrag={() => refetch()}>
          <View style={styles.header}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="person" size={28} color={theme.textSecondary} />
            </View>
            <ThemedText type="subtitle">{author}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('creator.filmCount', { n: films.length })}
            </ThemedText>
            <Pressable
              onPress={() => toggle(author)}
              style={[
                styles.follow,
                { borderColor: theme.text },
                following && { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
                !following && { backgroundColor: theme.text },
              ]}>
              <ThemedText
                type="smallBold"
                style={following ? undefined : { color: theme.background }}>
                {t(following ? 'reels.following' : 'reels.follow')}
              </ThemedText>
            </Pressable>
          </View>

          <View style={[styles.grid, { gap }]}>
            {films.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => router.push(`/reel/${f.id}`)}
                style={{
                  width: tile,
                  // Each tile keeps its film's real shape, so the grid shows at
                  // a glance whether someone makes shorts or films.
                  aspectRatio: isVertical(f.aspect) ? 9 / 16 : 16 / 9,
                }}>
                <Image
                  source={{ uri: publicReelThumbUrl(f.id) }}
                  style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>

          {films.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {t('creator.empty')}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.two,
  },
  body: {
    padding: Spacing.screen,
    gap: Spacing.four,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'center', gap: Spacing.one },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  follow: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  thumb: { width: '100%', height: '100%', borderRadius: 8 },
  empty: { textAlign: 'center' },
});
