import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiKey } from '@/api/api-key';
import { getApiBaseUrl } from '@/api/base-url';
import type { ExploreItem } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useFavorites } from '@/explore/favorites';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';

function Player({ uri }: { uri: string }) {
  const key = getApiKey();
  const player = useVideoPlayer(
    { uri, headers: key ? { Authorization: `Bearer ${key}` } : undefined },
    (p) => {
      p.loop = true;
      p.play();
    },
  );
  return <VideoView player={player} style={styles.poster} contentFit="contain" nativeControls />;
}

export default function ExploreDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    id?: string;
    url?: string;
    title?: string;
    prompt?: string;
    author?: string;
    accent?: string;
    durationLabel?: string;
    tierLabel?: string;
    likes?: string;
  }>();
  const { has, toggle } = useFavorites();
  const liked = params.id ? has(params.id) : false;

  const url = params.url ? `${getApiBaseUrl()}${params.url}` : '';

  const item: ExploreItem = {
    id: params.id ?? '',
    title: params.title ?? '',
    prompt: params.prompt ?? '',
    author: params.author ?? '',
    likes: Number(params.likes ?? 0) || 0,
    durationLabel: params.durationLabel ?? '',
    accent: params.accent ?? '#6D5DF6',
    tierLabel: params.tierLabel ?? '',
    url: params.url || null,
  };

  const like = () => {
    if (!params.id) return;
    toggle(item);
  };

  const remix = () => router.navigate({ pathname: '/', params: { seed: params.prompt ?? '' } });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {url ? (
            <Player uri={url} />
          ) : (
            <View style={[styles.poster, { backgroundColor: theme.backgroundSelected }]}>
              <Ionicons name="film-outline" size={40} color={theme.textSecondary} />
            </View>
          )}

          <ThemedText type="subtitle">{params.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {params.author}
          </ThemedText>
          {params.prompt ? (
            <ThemedView type="backgroundElement" style={styles.promptCard}>
              <ThemedText type="small" themeColor="textSecondary">
                {params.prompt}
              </ThemedText>
            </ThemedView>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={like}
              style={({ pressed }) => [
                styles.secondary,
                { borderColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={18}
                color={liked ? '#E5484D' : theme.text}
              />
              <ThemedText type="small">{t('explore.like')}</ThemedText>
            </Pressable>
          </View>

          <Pressable
            onPress={remix}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="sparkles-outline" size={18} color={theme.background} />
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {t('explore.remix')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  poster: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptCard: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  pressed: { opacity: 0.6 },
});
