import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';
import { CURRENT_PLAN_ID, PLANS } from '@/mocks/data';

export default function PlanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const [selected, setSelected] = useState<string>(CURRENT_PLAN_ID);

  const selectedName = t(`plan.${selected}.name`);
  const isCurrent = selected === CURRENT_PLAN_ID;
  const isFree = selected === 'free';

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Ionicons name="card-outline" size={22} color={theme.text} />
            <ThemedText type="smallBold">{t('plan.title')}</ThemedText>
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
            {t('plan.subtitle')}
          </ThemedText>

          {PLANS.map((p) => {
            const active = p.id === selected;
            const current = p.id === CURRENT_PLAN_ID;
            return (
              <Pressable
                key={p.id}
                onPress={() => setSelected(p.id)}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
                <ThemedView
                  type={active ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.plan}>
                  <View style={styles.planHead}>
                    <ThemedText type="smallBold" style={styles.flex}>
                      {t(`plan.${p.id}.name`)}
                    </ThemedText>
                    {current ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('plan.current')}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="smallBold">
                      {p.monthly === 0 ? t('plan.stayFree') : `$${p.monthly}`}
                      {p.monthly === 0 ? '' : t('plan.perMonth')}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(`plan.${p.id}.tagline`)}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              router.back();
              toast.show(t('toast.planUpdated'));
            }}
            disabled={isCurrent}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: theme.text, opacity: isCurrent ? 0.4 : pressed ? 0.75 : 1 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {isCurrent
                ? t('plan.current')
                : isFree
                  ? t('plan.stayFree')
                  : t('plan.choose', { name: selectedName })}
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
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
