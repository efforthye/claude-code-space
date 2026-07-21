// Admin console (ADR 0016) — stats, user board, and explore moderation.
// Server-gated: every call 403s unless the signed-in email is in
// MAYO_ADMIN_EMAILS, so this screen is useless (and hidden) for non-admins.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  adminAdjustCredits,
  adminDeleteExplore,
  adminSetPlan,
  getAdminStats,
  getAdminUsers,
  getExplore,
} from '@/api/client';
import type { AdminUser } from '@/api/types';
import { ErrorBlock, LoadingBlock } from '@/components/feedback';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

function fmtBytes(n: number): string {
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

export default function AdminScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { data: stats, loading, error, refetch } = useQuery(getAdminStats);
  const { data: usersList, refetch: refetchUsers } = useQuery(getAdminUsers);
  const { data: posts, refetch: refetchPosts } = useQuery(() => getExplore('latest'));
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (key: string, fn: () => Promise<unknown>, after?: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      await after?.();
      toast.show(t('admin.done'));
    } catch {
      toast.show(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const cyclePlan = (u: AdminUser) => {
    const next = u.planId === 'free' ? 'pro' : u.planId === 'pro' ? 'studio' : 'free';
    return act(`plan-${u.id}`, () => adminSetPlan(u.id, next), refetchUsers);
  };

  const statCards = stats
    ? ([
        [t('admin.users'), `${stats.users}`, `+${stats.signups7d} / 7d`],
        [t('admin.sessions'), `${stats.activeSessions}`, ''],
        [t('admin.videos'), `${stats.videos}`, fmtBytes(stats.storageBytes)],
        [
          t('admin.jobs'),
          `${stats.jobsQueued + stats.jobsGenerating}`,
          `done ${stats.jobsDone} · fail ${stats.jobsFailed}`,
        ],
        [t('admin.posts'), `${stats.explorePosts}`, `❤️${stats.likes} 💬${stats.comments}`],
        [t('admin.engagement'), `${stats.views}`, `↗️ ${stats.shares}`],
        [t('admin.credits'), `${stats.creditsOutstanding}`, ''],
        [t('admin.backends'), stats.generationBackend, stats.plannerBackend],
      ] as const)
    : [];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle">{t('admin.title')}</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loading && !stats ? <LoadingBlock /> : null}
          {error && !stats ? <ErrorBlock onRetry={refetch} error={error} /> : null}

          {stats ? (
            <View style={styles.grid}>
              {statCards.map(([label, value, sub]) => (
                <ThemedView key={label} type="backgroundElement" style={styles.card}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {label}
                  </ThemedText>
                  <ThemedText type="subtitle">{value}</ThemedText>
                  {sub ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {sub}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              ))}
            </View>
          ) : null}

          {/* User board */}
          <ThemedText type="smallBold">{t('admin.userBoard')}</ThemedText>
          {(usersList ?? []).map((u) => (
            <ThemedView key={u.id} type="backgroundElement" style={styles.userRow}>
              <View style={styles.flex}>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {u.name} <ThemedText type="small" themeColor="textSecondary">· {u.email}</ThemedText>
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {u.planId} · {t('admin.creditsN', { n: u.credits })} · {t('admin.videosN', { n: u.videos })}
                  {u.hasByok ? ' · BYOK' : ''} · {u.providers.join('/')}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => act(`credit-${u.id}`, () => adminAdjustCredits(u.id, 100), refetchUsers)}
                disabled={!!busy}
                style={[styles.miniBtn, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small">+100</ThemedText>
              </Pressable>
              <Pressable
                onPress={() => cyclePlan(u)}
                disabled={!!busy}
                style={[styles.miniBtn, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small">{t('admin.planBtn')}</ThemedText>
              </Pressable>
            </ThemedView>
          ))}

          {/* Explore moderation */}
          <ThemedText type="smallBold">{t('admin.moderation')}</ThemedText>
          {(posts ?? []).map((p) => (
            <ThemedView key={p.id} type="backgroundElement" style={styles.userRow}>
              <View style={styles.flex}>
                <ThemedText type="small" numberOfLines={1}>
                  {p.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {p.author} · ❤️{p.likes} 💬{p.comments ?? 0} 👁{p.views ?? 0}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => act(`del-${p.id}`, () => adminDeleteExplore(p.id), refetchPosts)}
                disabled={!!busy}
                hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color="#E5484D" />
              </Pressable>
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    gap: 2,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  miniBtn: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
});
