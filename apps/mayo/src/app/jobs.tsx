import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { JOBS, jobStatusLabel } from '@/mocks/data';

export default function JobsScreen() {
  return (
    <Screen
      title="Jobs"
      subtitle="Generation runs scene by scene. Watch progress, then grab it from your Library.">
      {JOBS.map((job) => {
        const progress = job.scenesTotal ? job.scenesDone / job.scenesTotal : 0;
        const done = job.status === 'done';
        return (
          <ThemedView key={job.id} type="backgroundElement" style={styles.card}>
            <View style={styles.headerRow}>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
                {job.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {jobStatusLabel(job.status)}
              </ThemedText>
            </View>
            <ProgressBar value={done ? 1 : progress} />
            <ThemedText type="small" themeColor="textSecondary">
              {done
                ? 'Completed — ready in Library'
                : `${job.scenesDone}/${job.scenesTotal} scenes${job.etaMin ? ` · ~${job.etaMin} min left` : ''}`}
            </ThemedText>
          </ThemedView>
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
});
