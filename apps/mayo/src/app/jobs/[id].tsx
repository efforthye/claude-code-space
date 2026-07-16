import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteJob, getJob } from '@/api/client';
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

export default function JobDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = id ?? '';
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
              await deleteJob(job.id);
              router.back();
              toast.show(t(active ? 'toast.jobCanceled' : 'toast.jobDeleted'));
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

            <ThemedText type="smallBold">{t('jobDetail.sceneMap')}</ThemedText>
            <View style={styles.dots}>
              {Array.from({ length: shownDots }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i < filledDots ? theme.text : theme.backgroundSelected },
                  ]}
                />
              ))}
            </View>

            <ThemedView type="backgroundElement" style={styles.note}>
              <ThemedText type="small" themeColor="textSecondary">
                {t(`jobDetail.note.${job.status}`)}
              </ThemedText>
            </ThemedView>

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
                onPress={() => router.back()}
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
    paddingHorizontal: Spacing.four,
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
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  note: {
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
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
