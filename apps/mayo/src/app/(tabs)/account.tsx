// "마이" (My) tab — the user's own space: profile, liked collection,
// notification inbox, plan/storage, and a door to Settings. All the knobs that
// used to crowd this tab live in the /settings modal now.

import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  authApple,
  getAdminStats,
  getStorage,
  githubLoginStart,
  githubLoginResult,
  googleLoginStart,
  googleLoginResult,
  type SnsPoll,
} from '@/api/client';
import { useAuth } from '@/auth/auth';
import { useToast } from '@/components/toast';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFavorites } from '@/explore/favorites';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { usePayments } from '@/payments/context';
import { useI18n } from '@/settings/settings';

export default function MyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { user, signOut, refreshUser } = useAuth();
  const { entitlement } = usePayments();
  const { favorites } = useFavorites();
  const { data: storage } = useQuery(getStorage);
  // Admin probe: the server 403s for everyone but MAYO_ADMIN_EMAILS accounts —
  // success is what reveals the console entry below.
  const { data: adminStats } = useQuery(getAdminStats, { enabled: !!user, deps: [user?.id] });
  const [linking, setLinking] = useState<string | null>(null);

  const linked = (p: string) => !!user?.providers?.includes(p);

  // Link another SNS to THIS account (server-driven start/poll with ?link=1).
  const linkVia = async (
    provider: string,
    start: (link: boolean) => Promise<{ loginId: string; url: string }>,
    poll: (loginId: string) => Promise<SnsPoll>,
  ) => {
    if (linking) return;
    setLinking(provider);
    try {
      const { loginId, url } = await start(true);
      WebBrowser.openBrowserAsync(url).catch(() => {});
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await poll(loginId).catch(() => null);
        if (res?.status === 'ready') {
          if (Platform.OS !== 'web') WebBrowser.dismissBrowser().catch(() => {});
          if (res.linked) {
            await refreshUser();
            toast.show(t('my.linkDone'));
          } else {
            toast.show(t('my.linkFailed'));
          }
          return;
        }
      }
      toast.show(t('my.linkFailed'));
    } catch {
      toast.show(t('my.linkFailed'));
    } finally {
      setLinking(null);
    }
  };

  const linkApple = async () => {
    if (linking) return;
    setLinking('apple');
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error('no identity token');
      await authApple(cred.identityToken, '', true);
      await refreshUser();
      toast.show(t('my.linkDone'));
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'ERR_REQUEST_CANCELED') toast.show(t('my.linkFailed'));
    } finally {
      setLinking(null);
    }
  };

  const Row = ({
    icon,
    label,
    value,
    badge,
    onPress,
    last,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value?: string;
    badge?: number;
    onPress: () => void;
    last?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowItem,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.backgroundSelected,
        },
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <ThemedText type="small" style={styles.rowLabel}>
        {label}
      </ThemedText>
      {badge ? (
        <View style={styles.badge}>
          <ThemedText type="small" style={styles.badgeText}>
            {badge > 99 ? '99+' : badge}
          </ThemedText>
        </View>
      ) : null}
      {value ? (
        <ThemedText type="small" themeColor="textSecondary">
          {value}
        </ThemedText>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );

  return (
    <Screen title={t('tab.account')} subtitle={t('my.subtitle')}>
      {user ? (
        <ThemedView type="backgroundElement" style={styles.authCard}>
          <Ionicons name="person-circle" size={40} color={theme.text} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">{user.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {user.email} ·{' '}
              {(user.providers?.length ? user.providers : [user.provider])
                .map((p) =>
                  p === 'google' ? 'Google' : p === 'github' ? 'GitHub' : p === 'apple' ? 'Apple' : t('auth.emailProvider'),
                )
                .join(' · ')}
            </ThemedText>
          </View>
          <Pressable onPress={signOut} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.signOut}>
              {t('auth.signOut')}
            </ThemedText>
          </Pressable>
        </ThemedView>
      ) : (
        <Pressable onPress={() => router.push('/login')}>
          <ThemedView type="backgroundElement" style={styles.authCard}>
            <Ionicons name="person-circle-outline" size={40} color={theme.textSecondary} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t('auth.signIn')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('auth.signInHint')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </ThemedView>
        </Pressable>
      )}

      {/* Linked logins: one account, many SNS — sign in with any of them. */}
      {user ? (
        <ThemedView type="backgroundElement" style={styles.rows}>
          {(
            [
              { p: 'google', icon: 'logo-google' as const, label: 'Google', onLink: () => linkVia('google', googleLoginStart, googleLoginResult) },
              { p: 'github', icon: 'logo-github' as const, label: 'GitHub', onLink: () => linkVia('github', githubLoginStart, githubLoginResult) },
              ...(Platform.OS === 'ios'
                ? [{ p: 'apple', icon: 'logo-apple' as const, label: 'Apple', onLink: linkApple }]
                : []),
            ] as const
          ).map((row, i, arr) => (
            <Pressable
              key={row.p}
              disabled={linked(row.p) || !!linking}
              onPress={row.onLink}
              style={({ pressed }) => [
                styles.rowItem,
                i < arr.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.backgroundSelected,
                },
                pressed && styles.pressed,
              ]}>
              <Ionicons name={row.icon} size={18} color={theme.textSecondary} />
              <ThemedText type="small" style={styles.rowLabel}>
                {row.label}
              </ThemedText>
              <ThemedText type="small" themeColor={linked(row.p) ? 'text' : 'textSecondary'}>
                {linking === row.p
                  ? t('my.linking')
                  : linked(row.p)
                    ? t('my.linked')
                    : t('my.link')}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      ) : null}

      {/* My stuff (notifications live in the header bell now, like every app) */}
      <ThemedView type="backgroundElement" style={styles.rows}>
        <Row
          icon="heart-outline"
          label={t('my.liked')}
          value={favorites.length ? String(favorites.length) : undefined}
          onPress={() =>
            favorites.length
              ? router.push({ pathname: '/reels', params: { mode: 'liked', index: '0' } })
              : router.push('/(tabs)/explore')
          }
        />
        <Row
          icon="film-outline"
          label={t('my.myVideos')}
          onPress={() => router.push('/(tabs)/library')}
          last
        />
      </ThemedView>

      {/* Plan + storage */}
      <Pressable
        onPress={() => router.push('/plan')}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
        <ThemedView type="backgroundElement" style={styles.plan}>
          <View style={styles.planTop}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t('account.plan')}
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
          <ThemedText type="subtitle">{t(`plan.${entitlement.planId}.name`)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(`plan.${entitlement.planId}.tagline`)}
          </ThemedText>
        </ThemedView>
      </Pressable>

      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold">{t('account.storage')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {storage ? `${storage.usedLabel} / ${storage.totalLabel}` : '—'}
          </ThemedText>
        </View>
        <ProgressBar value={storage?.usedRatio ?? 0} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('account.storageHint')}
        </ThemedText>
      </ThemedView>

      {/* Settings + billing */}
      <ThemedView type="backgroundElement" style={styles.rows}>
        {adminStats ? (
          <Row
            icon="shield-checkmark-outline"
            label={t('admin.title')}
            value={t('admin.rowValue', { n: adminStats.users })}
            onPress={() => router.push('/admin')}
          />
        ) : null}
        <Row
          icon="settings-outline"
          label={t('settings.title')}
          onPress={() => router.push('/settings')}
        />
        <Row
          icon="card-outline"
          label={t('account.billing')}
          value={t('account.billingValue')}
          onPress={() => router.push('/plan')}
          last
        />
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  authCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  signOut: { textDecorationLine: 'underline' },
  plan: { gap: Spacing.one, padding: Spacing.four, borderRadius: Spacing.four },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.four },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rows: { borderRadius: Spacing.four, paddingHorizontal: Spacing.three },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowLabel: { flex: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11 },
});
