import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getStorage, listVideos } from '@/api/client';
import { ErrorBlock, LoadingBlock } from '@/components/feedback';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

export default function LibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { data: videos, loading, error, refetch } = useQuery(listVideos, { pollMs: 15000 });
  const { data: storage, refetch: refetchStorage } = useQuery(getStorage);

  // Refresh when returning to the tab so finished/imported videos show up.
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchStorage();
    }, [refetch, refetchStorage]),
  );

  const retentionLabel = (days: number) => {
    if (days <= 0) return t('library.expired');
    if (days === 1) return t('library.expiresInOne');
    return t('library.expiresIn', { n: days });
  };

  return (
    <Screen
      title={t('tab.library')}
      subtitle={t('library.subtitle')}
      onRefresh={async () => {
        await Promise.all([refetch(), refetchStorage()]);
      }}>
      <Pressable
        onPress={() => router.push('/edit')}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
        <ThemedView type="backgroundElement" style={styles.editEntry}>
          <Ionicons name="cut-outline" size={20} color={theme.text} />
          <ThemedText type="smallBold" style={styles.flex}>
            {t('library.newEdit')}
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </ThemedView>
      </Pressable>

      {storage ? (
        <ThemedView type="backgroundElement" style={styles.storage}>
          <View style={styles.headerRow}>
            <ThemedText type="smallBold">{t('library.storage')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {storage.usedLabel} / {storage.totalLabel}
            </ThemedText>
          </View>
          <ProgressBar value={storage.usedRatio} />
        </ThemedView>
      ) : null}

      {loading && !videos ? <LoadingBlock /> : null}
      {error && !videos ? <ErrorBlock onRetry={refetch} /> : null}
      {videos?.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('common.empty')}
        </ThemedText>
      ) : null}

      {(videos ?? []).map((v) => (
        <Pressable
          key={v.id}
          onPress={() => router.push(`/library/${v.id}`)}
          style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={[styles.thumb, { backgroundColor: v.accent }]}>
              <Ionicons name="play" size={20} color="#ffffff" />
            </View>
            <View style={styles.meta}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {v.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {v.durationLabel} · {v.sizeLabel}
              </ThemedText>
              <ThemedText type="small" themeColor={v.expiresInDays <= 3 ? 'text' : 'textSecondary'}>
                {retentionLabel(v.expiresInDays)}
              </ThemedText>
            </View>
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Publish to YouTube"
                onPress={() => router.push(`/publish?id=${v.id}`)}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
                <Ionicons name="logo-youtube" size={22} color="#FF0000" />
              </Pressable>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </View>
          </ThemedView>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  editEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  storage: {
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});
