import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import {ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiKey } from '@/api/api-key';
import { getApiBaseUrl } from '@/api/base-url';
import { deleteJob, getJob, retryJob, mediaUrl } from '@/api/client';
import { ErrorBlock, LoadingBlock } from '@/components/feedback';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

const MAX_DOTS = 48;

function PreviewClip({ uri }: { uri: string }) {
  const key = getApiKey();
  const player = useVideoPlayer(
    { uri, headers: key ? { Authorization: `Bearer ${key}` } : undefined },
    (p) => {
      p.loop = true;
      p.muted = true;
      p.play();
    },
  );
  return <VideoView player={player} style={styles.preview} contentFit="cover" nativeControls={false} />;
}

function FullscreenPlayer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const key = getApiKey();
  const player = useVideoPlayer(
    { uri, headers: key ? { Authorization: `Bearer ${key}` } : undefined },
    (p) => {
      p.loop = true;
      p.play();
    },
  );
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.fullRoot}>
        <VideoView player={player} style={styles.fullVideo} contentFit="contain" nativeControls />
        <SafeAreaView edges={['top']} style={styles.fullClose} pointerEvents="box-none">
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function JobDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = id ?? '';
  const [fullUri, setFullUri] = useState<string | null>(null);
  const { data: job, loading, error, refetch } = useQuery(() => getJob(jobId), {
    pollMs: 1500,
    enabled: !!jobId,
    deps: [jobId],
  });

  const progress = job && job.scenesTotal ? job.scenesDone / job.scenesTotal : 0;
  const done = job?.status === 'done';
  const active = job?.status === 'queued' || job?.status === 'generating';
  const shownDots = job ? Math.min(job.scenesTotal, MAX_DOTS) : 0;
  const filledDots = done ? shownDots : Math.round(progress * shownDots);

  const confirmRemove = () => {
    if (!job) return;
    Alert.alert(
      t(active ? 'jobDetail.confirmCancelTitle' : 'jobDetail.confirmDeleteTitle'),
      t(active ? 'jobDetail.confirmCancelBody' : 'jobDetail.confirmDeleteBody'),
      [
        { text: t('jobDetail.keep'), style: 'cancel' },
        {
          text: t(active ? 'jobDetail.cancel' : 'jobDetail.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteJob(job.id);
              router.back();
              toast.show(
                active && res?.refundedCredits
                  ? t('toast.jobCanceledRefund', { n: res.refundedCredits })
                  : t(active ? 'toast.jobCanceled' : 'toast.jobDeleted'),
              );
            } catch {
              toast.show(t('common.error'));
            }
          },
        },
      ],
    );
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
        </View>

        {loading && !job ? <LoadingBlock /> : null}
        {error && !job ? <ErrorBlock onRetry={refetch} /> : null}

        {job ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <ThemedText type="subtitle">{job.title}</ThemedText>

            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.headerRow}>
                <ThemedText type="smallBold">{t('jobDetail.status')}</ThemedText>
                {active ? <ActivityIndicator size="small" /> : null}
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`status.${job.status}`)}
                </ThemedText>
              </View>
              <ProgressBar value={done ? 1 : progress} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('jobs.scenes', { done: job.scenesDone, total: job.scenesTotal })}
                {!done && job.etaMin ? t('jobs.eta', { n: job.etaMin }) : ''}
              </ThemedText>
            </ThemedView>

            {job.sceneUrls && job.sceneUrls.length > 0 ? (
              <>
                <ThemedText type="smallBold">{t('jobDetail.preview')}</ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.previewRow}>
                  {job.sceneUrls.map((u, i) => (
                    <Pressable key={i} onPress={() => setFullUri(mediaUrl(u))}>
                      <PreviewClip uri={mediaUrl(u)} />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : null}

            <ThemedText type="smallBold">{t('jobDetail.sceneMap')}</ThemedText>
            {/* Scene rows, not bare dots: WHAT is rendering and WHERE it is.
                (Owner: the dots said nothing about the scenes being made.) */}
            <ThemedView type="backgroundElement" style={styles.sceneList}>
              {Array.from({ length: shownDots }).map((_, i) => {
                const state =
                  i < job.scenesDone
                    ? 'done'
                    : i === job.scenesDone && job.status === 'generating'
                      ? 'rendering'
                      : 'waiting';
                const prompt =
                  job.scenePrompts && i < (job.scenePrompts?.length ?? 0)
                    ? job.scenePrompts[i]
                    : job.title;
                return (
                  <View key={i} style={styles.sceneRow}>
                    <Ionicons
                      name={
                        state === 'done'
                          ? 'checkmark-circle'
                          : state === 'rendering'
                            ? 'sync-outline'
                            : 'ellipse-outline'
                      }
                      size={16}
                      color={state === 'waiting' ? theme.textSecondary : theme.text}
                    />
                    <ThemedText
                      type="small"
                      numberOfLines={2}
                      themeColor={state === 'waiting' ? 'textSecondary' : 'text'}
                      style={styles.scenePrompt}>
                      {i + 1}. {prompt}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t(`jobDetail.scene.${state}`)}
                    </ThemedText>
                  </View>
                );
              })}
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.note}>
              <ThemedText type="small" themeColor="textSecondary">
                {t(`jobDetail.note.${job.status}`)}
              </ThemedText>
            </ThemedView>

            {/* Staged jobs are reviewed, not just watched — send them to the
                gate they are waiting at (ADR 0020). Legacy jobs have no
                segments and skip this entirely. */}
            {job.stage && job.stage !== 'clips' && job.stage !== 'done' ? (
              <Pressable
                onPress={() => router.push(`/jobs/${job.id}/review`)}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.text },
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="list-outline" size={20} color={theme.background} />
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {t('jobDetail.review')}
                </ThemedText>
              </Pressable>
            ) : null}

            {done ? (
              <Pressable
                onPress={() => router.navigate('/library')}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.text },
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="film-outline" size={20} color={theme.background} />
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {t('jobDetail.viewInLibrary')}
                </ThemedText>
              </Pressable>
            ) : null}

            {job.status === 'failed' ? (
              <Pressable
                onPress={async () => {
                  try {
                    await retryJob(job.id);
                    await refetch();
                    toast.show(t('jobDetail.retrying'));
                  } catch {
                    toast.show(t('common.error'));
                  }
                }}
                style={({ pressed }) => [
                  styles.secondary,
                  { borderColor: theme.backgroundSelected },
                  pressed && styles.pressed,
                ]}>
                <Ionicons name="refresh" size={18} color={theme.text} />
                <ThemedText type="small">{t('jobDetail.retry')}</ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={confirmRemove}
              style={({ pressed }) => [styles.destructive, pressed && styles.pressed]}>
              <Ionicons name="trash-outline" size={18} color="#E5484D" />
              <ThemedText type="small" style={{ color: '#E5484D' }}>
                {t(active ? 'jobDetail.cancel' : 'jobDetail.delete')}
              </ThemedText>
            </Pressable>
          </ScrollView>
        ) : null}
        {fullUri ? <FullscreenPlayer uri={fullUri} onClose={() => setFullUri(null)} /> : null}
      </SafeAreaView>
    </ThemedView>
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.screen,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  card: {
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
  sceneList: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  sceneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  scenePrompt: { flex: 1 },
  previewRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  preview: {
    width: 120,
    height: 120,
    borderRadius: Spacing.three,
    backgroundColor: '#000',
  },
  note: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  fullRoot: { flex: 1, backgroundColor: '#000' },
  fullVideo: { ...StyleSheet.absoluteFillObject },
  fullClose: { position: 'absolute', top: 0, right: 0, padding: Spacing.four },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth,
  },
  destructive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
