import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useInbox, type InboxItem } from '@/notify/inbox';
import { useI18n } from '@/settings/settings';

const ICONS: Record<InboxItem['icon'], keyof typeof Ionicons.glyphMap> = {
  film: 'film-outline',
  alert: 'alert-circle-outline',
  'cloud-upload': 'cloud-upload-outline',
  megaphone: 'megaphone-outline',
};

function timeAgo(ms: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return t('inbox.justNow');
  if (s < 3600) return t('inbox.minAgo', { n: Math.floor(s / 60) });
  if (s < 86400) return t('inbox.hourAgo', { n: Math.floor(s / 3600) });
  return t('inbox.dayAgo', { n: Math.floor(s / 86400) });
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { items, markAllRead, clear } = useInbox();

  // Opening the inbox reads everything (badge clears).
  useEffect(() => {
    markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Ionicons name="notifications-outline" size={20} color={theme.text} />
            <ThemedText type="smallBold">{t('my.inbox')}</ThemedText>
          </View>
          <View style={styles.titleWrap}>
            {items.length > 0 ? (
              <Pressable onPress={clear} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.clear}>
                  {t('inbox.clear')}
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={36} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t('inbox.empty')}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Row href={item.href}>
                <ThemedView type="backgroundElement" style={styles.item}>
                <Ionicons
                  name={ICONS[item.icon]}
                  size={22}
                  color={item.icon === 'alert' ? '#E5484D' : theme.text}
                />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{item.title}</ThemedText>
                  {item.body ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                      {item.body}
                    </ThemedText>
                  ) : null}
                </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {timeAgo(item.createdAt, t)}
                  </ThemedText>
                </ThemedView>
            </Row>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * A notification row, tappable only when it leads somewhere.
 *
 * This screen is a modal, so it dismisses itself before navigating — pushing
 * on top of it would leave the film playing underneath a sheet of
 * notifications.
 */
function Row({ href, children }: { href?: string; children: ReactNode }) {
  const router = useRouter();
  if (!href) return <>{children}</>;
  return (
    <Pressable
      onPress={() => {
        router.back();
        router.push(href as never);
      }}
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : undefined)}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.three,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  clear: { textDecorationLine: 'underline' },
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emptyText: { textAlign: 'center' },
});
