import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getExplore, likeExplore } from '@/api/client';
import type { ExploreItem } from '@/api/types';
import { ErrorBlock, LoadingBlock } from '@/components/feedback';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { data: items, loading, error, refetch } = useQuery(getExplore);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const toggleLike = (item: ExploreItem) => {
    if (liked.has(item.id)) return;
    setLiked((prev) => new Set(prev).add(item.id));
    likeExplore(item.id).catch(() => {
      // roll back if it failed
      setLiked((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    });
  };

  const remix = (item: ExploreItem) =>
    router.navigate({ pathname: '/', params: { seed: item.prompt } });

  const likeCount = (item: ExploreItem) => item.likes + (liked.has(item.id) ? 1 : 0);

  return (
    <Screen
      title={t('tab.explore')}
      subtitle={t('explore.subtitle')}
      onRefresh={async () => {
        await refetch();
      }}>
      {loading && !items ? <LoadingBlock /> : null}
      {error && !items ? <ErrorBlock onRetry={refetch} /> : null}

      {(items ?? []).map((item) => (
        <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
          <Pressable onPress={() => remix(item)}>
            <View style={[styles.poster, { backgroundColor: item.accent }]}>
              <Ionicons name="play" size={40} color="#ffffff" />
              <View style={styles.durationTag}>
                <ThemedText type="small" style={styles.durationText}>
                  {item.durationLabel}
                </ThemedText>
              </View>
            </View>
          </Pressable>

          <View style={styles.metaRow}>
            <View style={styles.meta}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {item.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.author} · {item.tierLabel}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => toggleLike(item)}
              accessibilityLabel={t('explore.like')}
              style={({ pressed }) => [styles.like, pressed && styles.pressed]}>
              <Ionicons
                name={liked.has(item.id) ? 'heart' : 'heart-outline'}
                size={18}
                color={liked.has(item.id) ? '#E5484D' : theme.textSecondary}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {likeCount(item)}
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={() => remix(item)}
            style={({ pressed }) => [
              styles.remix,
              { borderColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="sparkles-outline" size={16} color={theme.text} />
            <ThemedText type="smallBold">{t('explore.remix')}</ThemedText>
          </Pressable>
        </ThemedView>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  poster: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationTag: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.two,
  },
  durationText: {
    color: '#ffffff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  meta: {
    flex: 1,
    gap: Spacing.one,
  },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  remix: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
