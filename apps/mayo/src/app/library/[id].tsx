import { Ionicons } from '@expo/vector-icons';
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiKey } from '@/api/api-key';
import { getApiBaseUrl } from '@/api/base-url';
import { deleteVideo, getVideo, publishToExplore } from '@/api/client';
import { ErrorBlock, LoadingBlock } from '@/components/feedback';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

export default function VideoDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const videoId = id ?? '';
  const { data: video, loading, error, refetch } = useQuery(() => getVideo(videoId), {
    enabled: !!videoId,
    deps: [videoId],
  });
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (!video) return;
    if (!video.url) {
      toast.show(t('detail.noFile'));
      return;
    }
    if (downloading) return;
    setDownloading(true);
    try {
      const key = getApiKey();
      const target = `${cacheDirectory}${video.id}.mp4`;
      const { uri } = await downloadAsync(`${getApiBaseUrl()}${video.url}`, target, {
        headers: key ? { Authorization: `Bearer ${key}` } : undefined,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' });
      } else {
        toast.show(t('detail.downloaded'));
      }
    } catch {
      toast.show(t('common.error'));
    } finally {
      setDownloading(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(t('detail.deleteTitle'), t('detail.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('detail.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVideo(videoId);
            router.back();
            toast.show(t('detail.deleted'));
          } catch {
            toast.show(t('common.error'));
          }
        },
      },
    ]);
  };

  const shareToExplore = async () => {
    if (!video) return;
    if (!video.url) {
      toast.show(t('detail.noFile'));
      return;
    }
    try {
      await publishToExplore(video.id, video.title);
      toast.show(t('detail.sharedToExplore'));
    } catch {
      toast.show(t('common.error'));
    }
  };

  const retentionLabel = (days: number) => {
    if (days <= 0) return t('library.expired');
    if (days === 1) return t('library.expiresInOne');
    return t('library.expiresIn', { n: days });
  };

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
          {video ? (
            <Pressable
              onPress={confirmDelete}
              accessibilityLabel={t('detail.delete')}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
              <Ionicons name="trash-outline" size={22} color="#E5484D" />
            </Pressable>
          ) : null}
        </View>

        {loading && !video ? <LoadingBlock /> : null}
        {error ? (
          error.name === 'ApiError' && /404|not found/i.test(error.message) ? (
            <View style={styles.empty}>
              <Ionicons name="alert-circle-outline" size={40} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('detail.notFound')}
              </ThemedText>
            </View>
          ) : !video ? (
            <ErrorBlock onRetry={refetch} />
          ) : null
        ) : null}

        {video ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            {video.url ? (
              <FilmPlayer uri={`${getApiBaseUrl()}${video.url}`} />
            ) : (
              <View style={[styles.poster, { backgroundColor: video.accent }]}>
                <Ionicons name="play" size={44} color="#ffffff" />
              </View>
            )}

            <ThemedText type="subtitle">{video.title}</ThemedText>
            <ThemedText
              type="small"
              themeColor={video.expiresInDays <= 3 ? 'text' : 'textSecondary'}>
              {retentionLabel(video.expiresInDays)}
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.specs}>
              {(
                [
                  { label: t('detail.duration'), value: video.durationLabel },
                  { label: t('detail.size'), value: video.sizeLabel },
                  { label: t('detail.resolution'), value: video.resolution },
                  { label: t('detail.quality'), value: video.tierLabel },
                  { label: t('detail.scenes'), value: String(video.scenes) },
                  { label: t('detail.created'), value: video.createdLabel },
                ] as const
              ).map((spec, i, arr) => (
                <View
                  key={spec.label}
                  style={[
                    styles.specRow,
                    i < arr.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {spec.label}
                  </ThemedText>
                  <ThemedText type="smallBold">{spec.value}</ThemedText>
                </View>
              ))}
            </ThemedView>

            <Pressable
              onPress={() => router.push(`/publish?id=${video.id}`)}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.text },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="logo-youtube" size={20} color={theme.background} />
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {t('detail.publish')}
              </ThemedText>
            </Pressable>

            <View style={styles.secondaryRow}>
              <SecondaryButton
                icon="download-outline"
                label={downloading ? t('detail.downloading') : t('detail.download')}
                color={theme.text}
                border={theme.backgroundSelected}
                onPress={download}
              />
              <SecondaryButton
                icon="albums-outline"
                label={t('detail.downloadClips', { n: video.scenes })}
                color={theme.text}
                border={theme.backgroundSelected}
                onPress={() => toast.show(t('detail.clipsSoon'))}
              />
            </View>

            <SecondaryButton
              icon="compass-outline"
              label={t('detail.shareToExplore')}
              color={theme.text}
              border={theme.backgroundSelected}
              onPress={shareToExplore}
              full
            />

            <SecondaryButton
              icon="time-outline"
              label={t('detail.extend')}
              color={theme.text}
              border={theme.backgroundSelected}
              onPress={() => router.push(`/extend?id=${video.id}`)}
              full
            />
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

function FilmPlayer({ uri }: { uri: string }) {
  // The film is served from a protected endpoint, so pass the API key as a header.
  const key = getApiKey();
  const player = useVideoPlayer(
    { uri, headers: key ? { Authorization: `Bearer ${key}` } : undefined },
    (p) => {
      p.loop = true;
    },
  );
  return <VideoView player={player} style={styles.poster} contentFit="contain" nativeControls />;
}

function SecondaryButton({
  icon,
  label,
  color,
  border,
  full,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  border: string;
  full?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondary,
        { borderColor: border },
        full && styles.secondaryFull,
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={18} color={color} />
      <ThemedText type="small" numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  specs: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryFull: {
    flex: 0,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  pressed: {
    opacity: 0.6,
  },
});
