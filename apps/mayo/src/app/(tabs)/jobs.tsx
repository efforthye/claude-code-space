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

  return (
    <Screen title={t('tab.jobs')} subtitle={t('jobs.subtitle')}>
      {loading && !jobs ? <LoadingBlock /> : null}
      {error && !jobs ? <ErrorBlock onRetry={refetch} /> : null}
      {jobs?.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('common.empty')}
        </ThemedText>
      ) : null}
      {(jobs ?? []).map((job) => {
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
