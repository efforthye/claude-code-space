// "마이" (My) tab — the user's own space: profile, liked collection,
// notification inbox, plan/storage, and a door to Settings. All the knobs that
// used to crowd this tab live in the /settings modal now.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { getStorage } from '@/api/client';
import { useAuth } from '@/auth/auth';
import { ProgressBar } from '@/components/progress-bar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFavorites } from '@/explore/favorites';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useInbox } from '@/notify/inbox';
import { usePayments } from '@/payments/context';
import { useI18n } from '@/settings/settings';

export default function MyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const { entitlement } = usePayments();
  const { favorites } = useFavorites();
  const { unread } = useInbox();
  const { data: storage } = useQuery(getStorage);

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
              {user.email} · {user.provider === 'google' ? 'Google' : t('auth.emailProvider')}
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

      {/* My stuff: inbox, liked collection */}
      <ThemedView type="backgroundElement" style={styles.rows}>
        <Row
          icon="notifications-outline"
          label={t('my.inbox')}
          badge={unread}
          onPress={() => router.push('/notifications')}
        />
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
