import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useFollows } from '@/explore/follows';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';

/**
 * The people you follow.
 *
 * Deliberately plain: a list of handles, each opening that creator's page, each
 * unfollowable from here. The interesting screen is the creator page; this one
 * exists so following someone is reversible without hunting for a reel of
 * theirs in the feed.
 */
export default function FollowingScreen() {
  const { t } = useI18n();
  const theme = useTheme();
  const { following, toggle } = useFollows();

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold">{t('following.title')}</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {following.map((author) => (
            <View key={author} style={[styles.row, { borderColor: theme.backgroundElement }]}>
              <Pressable
                style={styles.who}
                onPress={() => router.push({ pathname: '/creator/[author]', params: { author } })}>
                <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="person" size={18} color={theme.textSecondary} />
                </View>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {author}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => toggle(author)}
                style={[styles.unfollow, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{t('reels.following')}</ThemedText>
              </Pressable>
            </View>
          ))}

          {following.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
              {t('following.empty')}
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.two,
  },
  body: {
    padding: Spacing.screen,
    gap: Spacing.two,
    maxWidth: 700,
    width: '100%',
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  unfollow: { paddingHorizontal: Spacing.three, paddingVertical: 6, borderRadius: 999 },
  empty: { textAlign: 'center', paddingVertical: Spacing.five },
});
