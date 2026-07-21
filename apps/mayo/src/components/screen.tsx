import { Ionicons } from '@expo/vector-icons';
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
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            handleRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.textSecondary}
              />
            ) : undefined
          }>
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.three,
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
