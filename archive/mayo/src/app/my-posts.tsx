// "내 게시물" — everything the signed-in account published to Explore, with
// owner-only management: hide/unhide (pull from the public feed, reversible)
// and permanent delete (two-tap confirm — works on native AND web).

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  deleteMyExplore,
  hideExplore,
  listMyExplore,
  mediaHeaders,
  thumbUrl,
  unhideExplore,
} from '@/api/client';
import type { ExploreItem } from '@/api/types';
import { useAuth } from '@/auth/auth';
import { useToast } from '@/components/toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';

export default function MyPostsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { user } = useAuth();
  const { data, refetch } = useQuery(listMyExplore, { enabled: !!user, deps: [user?.id] });
  const [busy, setBusy] = useState<string | null>(null);
  // Two-tap delete confirm: first tap arms THIS item, second tap deletes.
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const toggleHidden = async (item: ExploreItem) => {
    if (busy) return;
    setBusy(item.id);
    try {
      await (item.hidden ? unhideExplore(item.id) : hideExplore(item.id));
      toast.show(t(item.hidden ? 'myPosts.unhidden' : 'myPosts.hiddenDone'));
      refetch();
    } catch {
      toast.show(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (item: ExploreItem) => {
    if (busy) return;
    if (confirmId !== item.id) {
      setConfirmId(item.id);
      toast.show(t('myPosts.deleteConfirm'));
      return;
    }
    setBusy(item.id);
    try {
      await deleteMyExplore(item.id);
      toast.show(t('myPosts.deleted'));
      setConfirmId(null);
      refetch();
    } catch {
      toast.show(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const items = data ?? [];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Ionicons name="albums-outline" size={20} color={theme.text} />
            <ThemedText type="smallBold">{t('myPosts.title')}</ThemedText>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={36} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t('myPosts.empty')}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => {
            const thumb = thumbUrl(item.url);
            return (
              <ThemedView type="backgroundElement" style={[styles.item, item.hidden && styles.dim]}>
                {thumb ? (
                  <Image
                    source={{ uri: thumb, headers: mediaHeaders() }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: item.accent }]} />
                )}
                <View style={styles.flex}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {item.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {t('myPosts.stats', {
                      likes: item.likes,
                      comments: item.comments ?? 0,
                      views: item.views ?? 0,
                    })}
                  </ThemedText>
                  {item.hidden ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('myPosts.hiddenTag')}
                    </ThemedText>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => toggleHidden(item)}
                  disabled={busy === item.id}
                  hitSlop={8}
                  accessibilityLabel={t(item.hidden ? 'myPosts.unhide' : 'myPosts.hide')}>
                  <Ionicons
                    name={item.hidden ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={theme.text}
                  />
                </Pressable>
                <Pressable
                  onPress={() => remove(item)}
                  disabled={busy === item.id}
                  hitSlop={8}
                  accessibilityLabel={t('myPosts.delete')}>
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={confirmId === item.id ? '#E5484D' : theme.textSecondary}
                  />
                </Pressable>
              </ThemedView>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1, gap: 2 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.three,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
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
  dim: { opacity: 0.55 },
  thumb: { width: 44, height: 60, borderRadius: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emptyText: { textAlign: 'center' },
});
