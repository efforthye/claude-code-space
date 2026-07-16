import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';
import { RETENTION_PLANS, getVideo, type RetentionPlan } from '@/mocks/data';

export default function ExtendScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const video = getVideo(id ?? '');
  const [planId, setPlanId] = useState<string>(RETENTION_PLANS[0].id);

  const planLabel = (p: RetentionPlan) =>
    p.days === 0 ? t('extend.forever') : p.days === 7 ? t('extend.plan7') : t('extend.plan30');

  const currentLabel = video
    ? video.expiresInDays <= 0
      ? t('library.expired')
      : video.expiresInDays === 1
        ? t('library.expiresInOne')
        : t('library.expiresIn', { n: video.expiresInDays })
    : '';

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Ionicons name="time-outline" size={22} color={theme.text} />
            <ThemedText type="smallBold">{t('extend.title')}</ThemedText>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel={t('extend.cancel')}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('extend.subtitle')}
          </ThemedText>

          {video ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('extend.current', { label: currentLabel })}
            </ThemedText>
          ) : null}

          {RETENTION_PLANS.map((p) => {
            const selected = p.id === planId;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlanId(p.id)}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
                <ThemedView
                  type={selected ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.plan}>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? theme.text : theme.textSecondary}
                  />
                  <ThemedText type="smallBold" style={styles.flex}>
                    {planLabel(p)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('extend.planCredits', { n: p.credits })}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              router.back();
              toast.show(t('toast.extended'));
            }}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.text, opacity: pressed ? 0.75 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {t('extend.confirm')}
            </ThemedText>
          </Pressable>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
