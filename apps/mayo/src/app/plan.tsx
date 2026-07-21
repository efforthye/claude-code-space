import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CREDIT_PACKS, PLANS } from '@/api/catalog';
import { ApiError, startCheckout, startPackCheckout } from '@/api/client';
import { useAuth } from '@/auth/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';
import { usePayments } from '@/payments/context';

export default function PlanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { entitlement, products, purchasing, purchase, selectFree, restore } = usePayments();
  const currentPlanId = entitlement.planId;
  const [selected, setSelected] = useState<string>(currentPlanId);

  const priceLabel = (planId: string, monthly: number) => {
    const product = products.find((p) => p.planId === planId);
    if (product) return product.priceLabel;
    return monthly === 0 ? t('plan.stayFree') : `$${monthly}${t('plan.perMonth')}`;
  };

  const selectedName = t(`plan.${selected}.name`);
  const isCurrent = selected === currentPlanId;
  const isFree = selected === 'free';

  const confirm = async () => {
    if (isCurrent) return;
    if (isFree) {
      selectFree();
      router.back();
      toast.show(t('toast.planUpdated'));
      return;
    }
    const product = products.find((p) => p.planId === selected);
    if (!product) {
      toast.show(t('common.error'));
      return;
    }
    const result = await purchase(product.id);
    if (result.ok) {
      router.back();
      toast.show(t('toast.purchased'));
    } else if (!result.canceled) {
      toast.show(t('common.error'));
    }
  };

  const onRestore = async () => {
    const found = await restore();
    toast.show(found ? t('toast.restored') : t('toast.noPurchases'));
  };

  const { user } = useAuth();
  const [checkingOut, setCheckingOut] = useState(false);
  const [packBusy, setPackBusy] = useState<string | null>(null);

  // Credit packs: one-time card purchase, NO subscription needed — buying any
  // pack also unlocks the paid features (pay-as-you-go, ADR 0017 v2).
  const buyPack = async (packId: string) => {
    if (packBusy) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setPackBusy(packId);
    try {
      const { url } = await startPackCheckout(packId);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      toast.show(
        e instanceof ApiError && e.status === 400 ? t('plan.cardUnavailable') : t('common.error'),
      );
    } finally {
      setPackBusy(null);
    }
  };

  // Card payment (Stripe Checkout, web path) — needs a signed-in account so the
  // webhook can grant the plan to the right user.
  const payWithCard = async () => {
    if (checkingOut || isFree || isCurrent) return;
    if (!user) {
      router.push('/login');
      return;
    }
    setCheckingOut(true);
    try {
      const { url } = await startCheckout(selected);
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      toast.show(
        e instanceof ApiError && e.status === 400 ? t('plan.cardUnavailable') : t('common.error'),
      );
    } finally {
      setCheckingOut(false);
    }
  };

  const ctaLabel = isCurrent
    ? t('plan.current')
    : purchasing
      ? t('plan.purchasing')
      : isFree
        ? t('plan.switchFree')
        : t('plan.choose', { name: selectedName });

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
            const current = p.id === currentPlanId;
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
                    <ThemedText type="smallBold">{priceLabel(p.id, p.monthly)}</ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(`plan.${p.id}.tagline`)}
                  </ThemedText>
                  {p.monthlyCredits ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('plan.monthlyCredits', { n: p.monthlyCredits })}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              </Pressable>
            );
          })}

          <Pressable
            onPress={confirm}
            disabled={isCurrent || purchasing}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: theme.text,
                opacity: isCurrent || purchasing ? 0.4 : pressed ? 0.75 : 1,
              },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {ctaLabel}
            </ThemedText>
          </Pressable>

          {!isFree && !isCurrent ? (
            <Pressable
              onPress={payWithCard}
              disabled={checkingOut}
              style={({ pressed }) => [
                styles.cardBtn,
                { borderColor: theme.backgroundSelected, opacity: checkingOut ? 0.4 : pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="card-outline" size={16} color={theme.text} />
              <ThemedText type="smallBold">
                {checkingOut ? t('plan.purchasing') : t('plan.payWithCard')}
              </ThemedText>
            </Pressable>
          ) : null}

          {/* Credit packs — one-time purchase, no subscription required. */}
          <ThemedText type="smallBold" style={styles.packsTitle}>
            {t('plan.packs')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('plan.packsHint')}
          </ThemedText>
          {CREDIT_PACKS.map((pk) => (
            <ThemedView key={pk.id} type="backgroundElement" style={styles.plan}>
              <View style={styles.planHead}>
                <ThemedText type="smallBold" style={styles.flex}>
                  {t('plan.packCredits', { n: pk.credits })}
                </ThemedText>
                <ThemedText type="smallBold">${pk.usd}</ThemedText>
                <Pressable
                  onPress={() => buyPack(pk.id)}
                  disabled={!!packBusy}
                  style={({ pressed }) => [
                    styles.packBtn,
                    {
                      borderColor: theme.backgroundSelected,
                      opacity: packBusy === pk.id ? 0.4 : pressed ? 0.7 : 1,
                    },
                  ]}>
                  <ThemedText type="small">
                    {packBusy === pk.id ? t('plan.purchasing') : t('plan.buyPack')}
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          ))}

          <Pressable
            onPress={onRestore}
            disabled={purchasing}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.restore}>
              {t('plan.restore')}
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
    paddingHorizontal: Spacing.screen,
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
    paddingHorizontal: Spacing.screen,
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
  cardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: 1,
  },
  restore: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  packsTitle: { marginTop: Spacing.three },
  packBtn: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
