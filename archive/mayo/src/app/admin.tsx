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
  getAdminAudit,
  getAdminLedger,
  getAdminStats,
  getAdminTimeseries,
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
import { formatBytes } from '@/api/catalog';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

export default function AdminScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { data: stats, loading, error, refetch } = useQuery(getAdminStats);
  const { data: usersList, refetch: refetchUsers } = useQuery(getAdminUsers);
  const { data: posts, refetch: refetchPosts } = useQuery(() => getExplore('latest'));
  const { data: audit, refetch: refetchAudit } = useQuery(getAdminAudit);
  const { data: ledgerRows } = useQuery(getAdminLedger);
  const { data: series } = useQuery(getAdminTimeseries);
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
    return act(`plan-${u.id}`, () => adminSetPlan(u.id, next), async () => {
      await refetchUsers();
      await refetchAudit();
    });
  };

  const statCards = stats
    ? ([
        [t('admin.users'), `${stats.users}`, `+${stats.signups7d} / 7d`],
        [t('admin.sessions'), `${stats.activeSessions}`, ''],
        [t('admin.videos'), `${stats.videos}`, formatBytes(stats.storageBytes)],
        [
          t('admin.jobs'),
          `${stats.jobsQueued + stats.jobsGenerating}`,
          `done ${stats.jobsDone} · fail ${stats.jobsFailed}`,
        ],
        [
          t('admin.posts'),
          `${stats.explorePosts}`,
          `${t('admin.likesShort')} ${stats.likes} · ${t('admin.commentsShort')} ${stats.comments}`,
        ],
        [t('admin.engagement'), `${stats.views}`, `${t('admin.sharesShort')} ${stats.shares}`],
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
                  {p.author} · {t('admin.likesShort')} {p.likes} · {t('admin.commentsShort')}{' '}
                  {p.comments ?? 0} · {t('admin.viewsShort')} {p.views ?? 0}
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

          {/* Daily metric time series (accrued by stats reads — no scheduler) */}
          {series && series.length > 0 ? (
            <>
              <ThemedText type="smallBold">{t('admin.timeseries')}</ThemedText>
              {series.slice(-14).reverse().map((p) => (
                <ThemedView key={p.date} type="backgroundElement" style={styles.userRow}>
                  <ThemedText type="small" style={styles.seriesDate}>
                    {p.date}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                    {t('admin.seriesRow', {
                      users: p.users,
                      videos: p.videos,
                      posts: p.explorePosts,
                      views: p.views,
                    })}
                  </ThemedText>
                </ThemedView>
              ))}
            </>
          ) : null}

          {/* Business ledger — who spent what on which prompt, newest first */}
          {ledgerRows && ledgerRows.length > 0 ? (
            <>
              <ThemedText type="smallBold">{t('admin.ledger')}</ThemedText>
              {ledgerRows.slice(0, 30).map((r) => (
                <ThemedView key={String(r.id)} type="backgroundElement" style={styles.userRow}>
                  <View style={styles.flex}>
                    <ThemedText type="small" numberOfLines={1}>
                      {String(r.event)}
                      {r.credits ? ` · ${r.credits}cr` : ''}
                      {r.title ? ` · ${r.title}` : r.product ? ` · ${r.product}` : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {String(r.email || r.userId || '-')} · {new Date(Number(r.at) * 1000).toLocaleString()}
                    </ThemedText>
                  </View>
                </ThemedView>
              ))}
            </>
          ) : null}

          {/* Audit log — every mutating admin action, newest first */}
          {audit && audit.length > 0 ? (
            <>
              <ThemedText type="smallBold">{t('admin.audit')}</ThemedText>
              {audit.slice(0, 30).map((a) => (
                <ThemedView key={a.id} type="backgroundElement" style={styles.userRow}>
                  <View style={styles.flex}>
                    <ThemedText type="small">
                      {a.action}
                      {a.detail ? ` · ${a.detail}` : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {a.admin} · {a.target || '-'} ·{' '}
                      {new Date(a.at * 1000).toLocaleString()}
                    </ThemedText>
                  </View>
                </ThemedView>
              ))}
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
  seriesDate: { width: 84 },
  miniBtn: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
});
