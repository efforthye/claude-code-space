// Full-screen vertical reels pager (IG Reels-style) — shared by the Explore tab
// (embedded, viewport measured via onLayout so the tab bar is respected) and the
// standalone /reels route (liked collection, deep links).

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  addComment,
  getComments,
  getExplore,
  likeExplore,
  publicReelMediaUrl,
  seedExplore,
  shareExplore,
  unlikeExplore,
  viewExplore,
} from '@/api/client';
import type { ExploreComment, ExploreItem, ExploreSort } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useFavorites } from '@/explore/favorites';
import { useFollows } from '@/explore/follows';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

export type ReelsMode = 'popular' | 'latest' | 'liked';

// react-native-web ignores pagingEnabled — CSS scroll-snap does the paging on
// web instead (RNW passes these through; native ignores them via Platform).
const SNAP_CONTAINER =
  Platform.OS === 'web' ? ({ scrollSnapType: 'y mandatory' } as unknown as ViewStyle) : undefined;
const SNAP_PAGE =
  Platform.OS === 'web'
    ? ({ scrollSnapAlign: 'start', scrollSnapStop: 'always' } as unknown as ViewStyle)
    : undefined;

export function ReelsFeed({
  mode,
  startIndex = 0,
  overlay,
  seedable = false,
}: {
  mode: ReelsMode;
  startIndex?: number;
  /** Rendered above the pager (sort chips, close button…) — position absolutely. */
  overlay?: ReactNode;
  /** Show the sample-seeding flask (dev helper) even when the feed has items. */
  seedable?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { favorites } = useFavorites();
  const sort: ExploreSort = mode === 'latest' ? 'latest' : 'popular';
  const { data: fetched, refetch } = useQuery(() => getExplore(sort), {
    enabled: mode !== 'liked',
    deps: [sort],
  });
  const items = mode === 'liked' ? favorites : (fetched ?? []);

  // Measure our own viewport: inside the tab navigator the usable height is
  // smaller than the window (tab bar), and pagingEnabled needs exact pages.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [commentsFor, setCommentsFor] = useState<ExploreItem | null>(null);
  const [seeding, setSeeding] = useState(false);

  const onViewRef = useRef(({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  });
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 80 });

  // Web: viewability events are unreliable and pagingEnabled is a no-op, so
  // track the page from the scroll offset and offer explicit arrows too.
  const listRef = useRef<FlatList<ExploreItem>>(null);
  const goTo = (delta: number) => {
    const next = Math.max(0, Math.min(items.length - 1, activeIndex + delta));
    if (next === activeIndex) return;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  };

  return (
    <View
      style={styles.root}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.h > 0 && items.length > 0 ? (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(it) => it.id}
          pagingEnabled
          style={SNAP_CONTAINER}
          showsVerticalScrollIndicator={false}
          snapToInterval={size.h}
          snapToAlignment="start"
          decelerationRate="fast"
          initialScrollIndex={items.length > startIndex ? startIndex : 0}
          getItemLayout={(_, i) => ({ length: size.h, offset: size.h * i, index: i })}
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          onScroll={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.y / Math.max(1, size.h));
            setActiveIndex((prev) =>
              idx !== prev ? Math.max(0, Math.min(items.length - 1, idx)) : prev,
            );
          }}
          scrollEventThrottle={48}
          onRefresh={mode === 'liked' ? undefined : refetch}
          refreshing={false}
          renderItem={({ item, index }) => (
            <Reel
              item={item}
              width={size.w}
              height={size.h}
              active={index === activeIndex}
              onComment={() => setCommentsFor(item)}
              // Template flow: open the director with this creation's full
              // recipe (scenes + style) preloaded as context.
              onRemix={() => router.navigate({ pathname: '/director', params: { templateId: item.id } })}
            />
          )}
        />
      ) : size.h > 0 ? (
        <View style={styles.empty}>
          <Ionicons name="film-outline" size={36} color="#666" />
          <ThemedText type="small" style={styles.emptyText}>
            {t('reels.empty')}
          </ThemedText>
          {mode !== 'liked' ? (
            <Pressable
              onPress={async () => {
                if (seeding) return;
                setSeeding(true);
                try {
                  await seedExplore();
                  await refetch();
                } catch {
                  // server without ffmpeg, or network blip — leave the empty state
                } finally {
                  setSeeding(false);
                }
              }}
              style={styles.seedBtn}>
              <Ionicons name="flask-outline" size={16} color="#000" />
              <ThemedText type="smallBold" style={styles.seedText}>
                {seeding ? t('reels.seeding') : t('reels.seed')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {overlay}
      {Platform.OS === 'web' && items.length > 1 ? (
        <View style={styles.webNav} pointerEvents="box-none">
          <Pressable
            onPress={() => goTo(-1)}
            disabled={activeIndex <= 0}
            style={[styles.webNavBtn, activeIndex <= 0 && styles.webNavBtnOff]}>
            <Ionicons name="chevron-up" size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => goTo(1)}
            disabled={activeIndex >= items.length - 1}
            style={[styles.webNavBtn, activeIndex >= items.length - 1 && styles.webNavBtnOff]}>
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
        </View>
      ) : null}
      {seedable && mode !== 'liked' && items.length > 0 ? (
        <SafeAreaView edges={['top']} style={styles.seedFabWrap} pointerEvents="box-none">
          <Pressable
            onPress={async () => {
              if (seeding) return;
              setSeeding(true);
              try {
                await seedExplore();
                await refetch();
              } catch {
                // server without ffmpeg — quietly ignore
              } finally {
                setSeeding(false);
              }
            }}
            hitSlop={8}
            style={styles.seedFab}>
            <Ionicons name={seeding ? 'hourglass-outline' : 'flask-outline'} size={18} color="#fff" />
          </Pressable>
        </SafeAreaView>
      ) : null}
      <CommentsSheet item={commentsFor} onClose={() => setCommentsFor(null)} />
    </View>
  );
}

function Reel({
  item,
  width,
  height,
  active,
  onComment,
  onRemix,
}: {
  item: ExploreItem;
  width: number;
  height: number;
  active: boolean;
  onComment: () => void;
  onRemix: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { has, toggle } = useFavorites();
  const follows = useFollows();
  // Published reels stream from the credential-free public endpoint, so the
  // feed plays for signed-out mayo.im visitors too.
  const uri = item.url ? publicReelMediaUrl(item.id) : '';

  // LIKE (heart) — a server signal, one per account when signed in; separate
  // from SAVE (bookmark), which is a private local collection.
  const [liked, setLiked] = useState(!!item.likedByMe);
  const [likeCount, setLikeCount] = useState(item.likes);
  useEffect(() => {
    setLiked(!!item.likedByMe);
    setLikeCount(item.likes);
  }, [item.id, item.likedByMe, item.likes]);
  const doLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    (next ? likeExplore(item.id) : unlikeExplore(item.id)).catch(() => {});
  };

  const player = useVideoPlayer(uri ? { uri } : null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!uri) return;
    if (active) player.play();
    else player.pause();
  }, [active, player, uri]);

  // Impression ping once per activation — the `views` ranking signal.
  useEffect(() => {
    if (!active) return;
    viewExplore(item.id).catch(() => {});
  }, [active, item.id]);

  // External share: an INSTANT share sheet carrying a promo message + the
  // public reel link (mayo.im/reel/<id>) — recipients watch without an account
  // and land on mayo branding, so every share markets the product. Completions
  // feed the `shares` ranking signal.
  const [shareBump, setShareBump] = useState(0);
  const share = async () => {
    const url = `https://mayo.im/reel/${item.id}`;
    const message = t('reels.shareMessage', { title: item.title });
    try {
      if (Platform.OS === 'web') {
        const nav = (globalThis as { navigator?: { share?: (d: unknown) => Promise<void>; clipboard?: { writeText: (s: string) => Promise<void> } } }).navigator;
        if (nav?.share) {
          await nav.share({ title: 'mayo', text: message, url });
        } else {
          await nav?.clipboard?.writeText(`${message}\n${url}`);
          toast.show(t('reels.linkCopied'));
        }
      } else {
        // iOS shows both; Android uses message — include the link in it.
        await Share.share({ message: `${message}\n${url}`, url });
      }
      setShareBump((n) => n + 1);
      shareExplore(item.id).catch(() => {});
    } catch {
      // user closed the sheet — not a share, no ping
    }
  };

  return (
    <View style={[{ width, height, backgroundColor: '#000' }, SNAP_PAGE]}>
      {uri ? (
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: item.accent }]} />
      )}

      {/* right action rail */}
      <View style={styles.rail} pointerEvents="box-none">
        <Action
          icon={liked ? 'heart' : 'heart-outline'}
          color={liked ? '#E5484D' : '#ffffff'}
          label={String(likeCount)}
          onPress={doLike}
        />
        <Action
          icon={has(item.id) ? 'bookmark' : 'bookmark-outline'}
          color={has(item.id) ? '#E2A43B' : '#ffffff'}
          label={t(has(item.id) ? 'reels.saved' : 'reels.save')}
          onPress={() => toggle(item)}
        />
        <Action icon="chatbubble-outline" color="#ffffff" label={String(item.comments ?? 0)} onPress={onComment} />
        <Action
          icon="paper-plane-outline"
          color="#ffffff"
          label={String((item.shares ?? 0) + shareBump)}
          onPress={share}
        />
      </View>

      {/* bottom info */}
      <SafeAreaView edges={['bottom']} style={styles.bottom} pointerEvents="box-none">
        <View style={styles.authorRow}>
          <ThemedText type="smallBold" style={styles.white}>
            {item.author}
          </ThemedText>
          <Pressable
            onPress={() => follows.toggle(item.author)}
            style={[styles.followBtn, follows.isFollowing(item.author) && styles.followingBtn]}>
            <ThemedText type="small" style={follows.isFollowing(item.author) ? styles.followingText : styles.followText}>
              {follows.isFollowing(item.author) ? t('reels.following') : t('reels.follow')}
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText type="small" style={styles.white} numberOfLines={2}>
          {item.title}
        </ThemedText>

        <Pressable onPress={onRemix} style={styles.remix}>
          <Ionicons name="sparkles" size={16} color="#000" />
          <ThemedText type="smallBold" style={{ color: '#000' }}>
            {t('reels.remix')}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

function Action({
  icon,
  color,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action} hitSlop={8}>
      <Ionicons name={icon} size={30} color={color} />
      <ThemedText type="small" style={styles.white}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function CommentsSheet({ item, onClose }: { item: ExploreItem | null; onClose: () => void }) {
  const { t } = useI18n();
  const [comments, setComments] = useState<ExploreComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!item) return;
    setComments([]);
    setLoading(true);
    getComments(item.id)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [item]);

  const send = async () => {
    if (!item || !text.trim() || sending) return;
    setSending(true);
    try {
      const c = await addComment(item.id, text.trim());
      setComments((prev) => [...prev, c]);
      setText('');
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <ThemedText type="smallBold">{t('reels.comments')}</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#888" />
            </Pressable>
          </View>
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            style={styles.commentList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              loading ? (
                <ActivityIndicator style={styles.loading} />
              ) : (
                <ThemedText type="small" themeColor="textSecondary" style={styles.loading}>
                  {t('reels.noComments')}
                </ThemedText>
              )
            }
            renderItem={({ item: c }) => (
              <View style={styles.comment}>
                <ThemedText type="smallBold">{c.author}</ThemedText>
                <ThemedText type="small">{c.text}</ThemedText>
              </View>
            )}
          />
          <View style={styles.commentInputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('reels.commentPlaceholder')}
              placeholderTextColor="#888"
              style={styles.commentInput}
              onSubmitEditing={send}
            />
            <Pressable onPress={send} disabled={!text.trim() || sending} style={styles.sendBtn}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  emptyText: { color: '#999', textAlign: 'center', paddingHorizontal: Spacing.five },
  seedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  seedText: { color: '#000000' },
  webNav: {
    position: 'absolute',
    right: Spacing.three,
    top: '50%',
    marginTop: -48,
    gap: Spacing.two,
    alignItems: 'center',
  },
  webNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webNavBtnOff: { opacity: 0.25 },
  seedFabWrap: { position: 'absolute', top: 0, right: 0 },
  seedFab: {
    margin: Spacing.three,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: {
    position: 'absolute',
    right: Spacing.three,
    bottom: 160,
    gap: Spacing.four,
    alignItems: 'center',
  },
  action: { alignItems: 'center', gap: 2 },
  white: { color: '#ffffff' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 72,
    bottom: 0,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  followBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  followingBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'transparent' },
  followText: { color: '#ffffff' },
  followingText: { color: '#ffffff' },
  remix: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: '#ffffff',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    marginTop: Spacing.two,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Spacing.four,
    maxHeight: '70%',
    minHeight: 320,
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.four,
  },
  commentList: { paddingHorizontal: Spacing.four, flexGrow: 0, minHeight: 120 },
  loading: { padding: Spacing.four, textAlign: 'center' },
  comment: { paddingVertical: Spacing.two, gap: 2 },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  commentInput: {
    flex: 1,
    color: '#fff',
    backgroundColor: '#2c2c2e',
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6D5DF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
