import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { listJobs } from '@/api/client';
import { ErrorBlock, LoadingBlock } from '@/components/feedback';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

export default function JobsScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const { data: jobs, loading, error, refetch } = useQuery(listJobs, { pollMs: 2500 });

  const statusColor = (status: string) =>
    status === 'generating'
      ? '#3BA55D'
      : status === 'failed'
        ? '#E5484D'
        : theme.textSecondary;
  const rank = (status: string) =>
    status === 'generating' ? 0 : status === 'queued' ? 1 : status === 'failed' ? 2 : 3;
  const sorted = [...(jobs ?? [])].sort((a, b) => rank(a.status) - rank(b.status));
  const active = (jobs ?? []).filter(
    (j) => j.status === 'generating' || j.status === 'queued',
  ).length;

  return (
    <Screen
      title={t('tab.jobs')}
      subtitle={t('jobs.subtitle')}
      onRefresh={async () => {
        await refetch();
      }}>
      {loading && !jobs ? <LoadingBlock /> : null}
      {error && !jobs ? <ErrorBlock onRetry={refetch} error={error} /> : null}
      {active ? (
        <ThemedView type="backgroundElement" style={styles.activeBar}>
          <View style={[styles.liveDot, { backgroundColor: '#3BA55D' }]} />
          <ThemedText type="smallBold">{t('jobs.activeCount', { n: active })}</ThemedText>
        </ThemedView>
      ) : null}
      {jobs?.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('common.empty')}
        </ThemedText>
      ) : null}
      {sorted.map((job) => {
        const progress = job.scenesTotal ? job.scenesDone / job.scenesTotal : 0;
        const done = job.status === 'done';
        return (
          <Pressable
            key={job.id}
            onPress={() => router.push(`/jobs/${job.id}`)}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.headerRow}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
                  {job.title}
                </ThemedText>
                <View style={[styles.statusDot, { backgroundColor: statusColor(job.status) }]} />
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`status.${job.status}`)}
                </ThemedText>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </View>
              <ProgressBar value={done ? 1 : progress} />
              <ThemedText type="small" themeColor="textSecondary">
                {done
                  ? t('jobs.completed')
                  : t('jobs.scenes', { done: job.scenesDone, total: job.scenesTotal }) +
                    (job.etaMin ? t('jobs.eta', { n: job.etaMin }) : '')}
              </ThemedText>
            </ThemedView>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  activeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
