import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getApiKey } from '@/api/api-key';
import { getApiBaseUrl } from '@/api/base-url';
import { getExplore } from '@/api/client';
import type { ExploreItem, ExploreSort } from '@/api/types';
import { Chip } from '@/components/chip';
import { ErrorBlock, LoadingBlock } from '@/components/feedback';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFavorites } from '@/explore/favorites';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n, useSettings } from '@/settings/settings';

function AutoPreview({
  uri,
  duration,
  onPress,
}: {
  uri: string;
  duration: string;
  onPress: () => void;
}) {
  const key = getApiKey();
  const player = useVideoPlayer(
    { uri, headers: key ? { Authorization: `Bearer ${key}` } : undefined },
    (p) => {
      p.muted = true;
      p.loop = true;
      p.play();
    },
  );
  return (
    <Pressable onPress={onPress}>
      <View style={styles.posterClip}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
        <View style={styles.durationTag}>
          <ThemedText type="small" style={styles.durationText}>
            {duration}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
}

type Mode = 'popular' | 'latest' | 'liked';

export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { favorites, has, toggle } = useFavorites();
  const { exploreAutoplay } = useSettings();
  const [mode, setMode] = useState<Mode>('popular');
  const sort: ExploreSort = mode === 'latest' ? 'latest' : 'popular';
  const { data: items, loading, error, refetch } = useQuery(() => getExplore(sort), { deps: [sort] });

  const list = mode === 'liked' ? favorites : (items ?? []);

  const remix = (item: ExploreItem) =>
    router.navigate({ pathname: '/', params: { seed: item.prompt } });

  const open = (item: ExploreItem) =>
    router.push({
      pathname: '/explore/[id]',
      params: {
        id: item.id,
        url: item.url ?? '',
        title: item.title,
        prompt: item.prompt,
        author: item.author,
        accent: item.accent,
        durationLabel: item.durationLabel,
        tierLabel: item.tierLabel,
        likes: String(item.likes),
      },
    });

  return (
    <Screen
      title={t('tab.explore')}
      subtitle={t('explore.subtitle')}
      onRefresh={async () => {
        await refetch();
      }}>
      <View style={styles.sortRow}>
        <Chip label={t('explore.popular')} selected={mode === 'popular'} onPress={() => setMode('popular')} />
        <Chip label={t('explore.latest')} selected={mode === 'latest'} onPress={() => setMode('latest')} />
        <Chip label={t('explore.liked')} selected={mode === 'liked'} onPress={() => setMode('liked')} />
      </View>

      {mode !== 'liked' && loading && !items ? <LoadingBlock /> : null}
      {mode !== 'liked' && error && !items ? <ErrorBlock onRetry={refetch} /> : null}
      {list.length === 0 && !(mode !== 'liked' && loading && !items) ? (
        <ThemedView type="backgroundElement" style={styles.empty}>
          <Ionicons
            name={mode === 'liked' ? 'heart-outline' : 'compass-outline'}
            size={36}
            color={theme.textSecondary}
          />
          <ThemedText type="smallBold">
            {mode === 'liked' ? t('explore.likedEmptyTitle') : t('explore.emptyTitle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
            {mode === 'liked' ? t('explore.likedEmptyBody') : t('explore.emptyBody')}
          </ThemedText>
        </ThemedView>
      ) : null}

      {list.map((item) => (
        <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
          {exploreAutoplay && item.url ? (
            <AutoPreview
              uri={`${getApiBaseUrl()}${item.url}`}
              duration={item.durationLabel}
              onPress={() => open(item)}
            />
          ) : (
            <Pressable onPress={() => open(item)}>
              <View style={[styles.poster, { backgroundColor: item.accent }]}>
                <Ionicons name="play" size={40} color="#ffffff" />
                <View style={styles.durationTag}>
                  <ThemedText type="small" style={styles.durationText}>
                    {item.durationLabel}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          )}

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
              onPress={() => toggle(item)}
              accessibilityLabel={t('explore.like')}
              style={({ pressed }) => [styles.like, pressed && styles.pressed]}>
              <Ionicons
                name={has(item.id) ? 'heart' : 'heart-outline'}
                size={18}
                color={has(item.id) ? '#E5484D' : theme.textSecondary}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {item.likes + (has(item.id) ? 1 : 0)}
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
  sortRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  empty: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
    borderRadius: Spacing.four,
  },
  emptyText: {
    textAlign: 'center',
  },
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
  posterClip: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    backgroundColor: '#000',
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
