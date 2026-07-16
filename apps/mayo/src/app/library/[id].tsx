import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';
import { getVideo } from '@/mocks/data';

export default function VideoDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const video = getVideo(id ?? '');

  const retentionLabel = (days: number) => {
    if (days <= 0) return t('library.expired');
    if (days === 1) return t('library.expiresInOne');
    return t('library.expiresIn', { n: days });
  };

  return (
    <ThemedView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <Ionicons name="chevron-back" size={26} color={theme.text} />
          </Pressable>
        </View>

        {!video ? (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('detail.notFound')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={[styles.poster, { backgroundColor: video.accent }]}>
              <Ionicons name="play" size={44} color="#ffffff" />
            </View>

            <ThemedText type="subtitle">{video.title}</ThemedText>
            <ThemedText
              type="small"
              themeColor={video.expiresInDays <= 3 ? 'text' : 'textSecondary'}>
              {retentionLabel(video.expiresInDays)}
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.specs}>
              {(
                [
                  { label: t('detail.duration'), value: video.durationLabel },
                  { label: t('detail.size'), value: video.sizeLabel },
                  { label: t('detail.resolution'), value: video.resolution },
                  { label: t('detail.quality'), value: video.tierLabel },
                  { label: t('detail.scenes'), value: String(video.scenes) },
                  { label: t('detail.created'), value: video.createdLabel },
                ] as const
              ).map((spec, i, arr) => (
                <View
                  key={spec.label}
                  style={[
                    styles.specRow,
                    i < arr.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {spec.label}
                  </ThemedText>
                  <ThemedText type="smallBold">{spec.value}</ThemedText>
                </View>
              ))}
            </ThemedView>

            <Pressable
              onPress={() => router.push(`/publish?id=${video.id}`)}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: theme.text },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="logo-youtube" size={20} color={theme.background} />
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {t('detail.publish')}
              </ThemedText>
            </Pressable>

            <View style={styles.secondaryRow}>
              <SecondaryButton
                icon="download-outline"
                label={t('detail.download')}
                color={theme.text}
                border={theme.backgroundSelected}
              />
              <SecondaryButton
                icon="albums-outline"
                label={t('detail.downloadClips', { n: video.scenes })}
                color={theme.text}
                border={theme.backgroundSelected}
              />
            </View>

            <SecondaryButton
              icon="time-outline"
              label={t('detail.extend')}
              color={theme.text}
              border={theme.backgroundSelected}
              full
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function SecondaryButton({
  icon,
  label,
  color,
  border,
  full,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  border: string;
  full?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondary,
        { borderColor: border },
        full && styles.secondaryFull,
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={18} color={color} />
      <ThemedText type="small" numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  poster: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specs: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryFull: {
    flex: 0,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  pressed: {
    opacity: 0.6,
  },
});
