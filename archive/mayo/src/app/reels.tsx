// Standalone reels route — used for the liked collection and deep links with a
// start index. The Explore tab embeds the same feed directly (reels-feed.tsx).

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReelsFeed, type ReelsMode } from '@/explore/reels-feed';
import { Spacing } from '@/constants/theme';

export default function ReelsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; index?: string }>();
  const mode = (params.mode ?? 'popular') as ReelsMode;
  const startIndex = Math.max(0, parseInt(params.index ?? '0', 10) || 0);

  return (
    <ReelsFeed
      mode={mode}
      startIndex={startIndex}
      overlay={
        <SafeAreaView edges={['top']} style={styles.closeWrap} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>
        </SafeAreaView>
      }
    />
  );
}

const styles = StyleSheet.create({
  closeWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  close: { padding: Spacing.four, alignSelf: 'flex-start' },
});
