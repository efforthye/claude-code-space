// PUBLIC shared-reel page — where a shared link (https://mayo.im/reel/<id>)
// lands. Works with NO account: the video streams from the unauthenticated
// /v1/public endpoints (explore-published content only), wrapped in mayo
// branding with a "make your own" CTA — every share markets the product.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPublicReel, publicReelMediaUrl } from '@/api/client';
import { LoadingBlock } from '@/components/feedback';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

export default function PublicReelScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const reelId = id ?? '';
  const { data: reel, loading } = useQuery(() => getPublicReel(reelId), {
    enabled: !!reelId,
    deps: [reelId],
  });

  const player = useVideoPlayer(reel ? { uri: publicReelMediaUrl(reel.id) } : null, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Brand header */}
          <Pressable onPress={() => router.replace('/')} style={styles.brandRow}>
            <Image source={require('../../../assets/images/icon.png')} style={styles.logo} />
            <ThemedText type="subtitle">mayo</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t('reel.tagline')}
            </ThemedText>
          </Pressable>

          {loading && !reel ? <LoadingBlock /> : null}
          {!loading && !reel ? (
            <View style={styles.missing}>
              <Ionicons name="film-outline" size={36} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('reel.notFound')}
              </ThemedText>
            </View>
          ) : null}

          {reel ? (
            <>
              <View style={styles.playerWrap}>
                <VideoView player={player} style={styles.player} contentFit="contain" nativeControls />
              </View>
              <ThemedText type="subtitle">{reel.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {reel.author} · {t('reel.likes', { n: reel.likes })} ·{' '}
                {t('reel.comments', { n: reel.comments ?? 0 })}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.promptCard}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('reel.promptLabel')}
                </ThemedText>
                <ThemedText type="small">{reel.prompt}</ThemedText>
              </ThemedView>

              {/* The pitch: this was made with AI in mayo — go make yours. */}
              <Pressable
                onPress={() => router.replace('/')}
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: theme.text, opacity: pressed ? 0.85 : 1 },
                ]}>
                <Ionicons name="sparkles" size={18} color={theme.background} />
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {t('reel.cta')}
                </ThemedText>
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary" style={styles.ctaHint}>
                {t('reel.ctaHint')}
              </ThemedText>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1, textAlign: 'right' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: { width: 34, height: 34, borderRadius: 9 },
  missing: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
  playerWrap: { borderRadius: Spacing.four, overflow: 'hidden', backgroundColor: '#000' },
  player: { width: '100%', aspectRatio: 9 / 16, maxHeight: 480, alignSelf: 'center' },
  promptCard: { gap: Spacing.one, padding: Spacing.three, borderRadius: Spacing.four },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  ctaHint: { textAlign: 'center' },
});
