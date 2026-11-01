import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useInbox } from '@/notify/inbox';

export function Screen({
  title,
  subtitle,
  children,
  onRefresh,
  bell = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Enables pull-to-refresh; called on pull. */
  onRefresh?: () => void | Promise<void>;
  /** Show the notification bell in the header (default on — every tab). */
  bell?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { unread } = useInbox();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = onRefresh
    ? async () => {
        setRefreshing(true);
        // The tick that tells you the pull registered. Without it a refresh on
        // an already-current screen is indistinguishable from a failed gesture,
        // because nothing on screen changes. Haptics are a no-op on web and on
        // Android devices without a motor, so this needs no platform guard.
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        {/*
          The header sits OUTSIDE the ScrollView on purpose. A RefreshControl
          pushes its scroll view's content down to make room for the spinner,
          and with the title and bell inside that meant the whole screen slid
          down and back on every pull. Keeping the header fixed leaves only the
          list moving, which is what the gesture is actually about.
        */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle" style={styles.title}>
              {title}
            </ThemedText>
            {bell ? (
              <Pressable
                onPress={() => router.push('/notifications')}
                hitSlop={10}
                accessibilityLabel="Notifications"
                style={({ pressed }) => [styles.bell, pressed && styles.pressed]}>
                <Ionicons name="notifications-outline" size={23} color={theme.text} />
                {unread > 0 ? (
                  <View style={styles.badge}>
                    <ThemedText type="small" style={styles.badgeText}>
                      {unread > 99 ? '99+' : unread}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          // Short screens do not overscroll by default on iOS, so a screen with
          // little content had no way to reach the refresh gesture at all —
          // which is why 작업 appeared to have lost pull-to-refresh even though
          // it passes onRefresh.
          alwaysBounceVertical={!!handleRefresh}
          refreshControl={
            handleRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.textSecondary}
              />
            ) : undefined
          }>
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.three,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.half,
  },
  title: {
    flex: 1,
  },
  bell: {
    padding: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    lineHeight: 12,
  },
  subtitle: {
    marginBottom: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
