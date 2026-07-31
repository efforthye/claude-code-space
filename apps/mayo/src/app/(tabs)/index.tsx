import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { estimateCredits, formatDuration, useCatalog } from '@/api/catalog';
import { estimateJob } from '@/api/client';
import { ApiError, createJob, getSettings } from '@/api/client';
import type { Aspect } from '@/api/types';
import { useQuery } from '@/hooks/use-query';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useSettings } from '@/settings/settings';

type Unit = 'sec' | 'min';

/**
 * What kind of film, asked before anything technical.
 *
 * Five aspect ratios and seven durations on one screen is a settings panel, not
 * a question. People arrive knowing "a short" or "a proper film", and every
 * other choice follows from that — so ask the thing they already know and
 * derive the rest.
 */
const FORMATS = [
  {
    id: 'shorts' as const,
    aspect: '9:16' as Aspect,
    // Vertical feeds cut off past a minute; offering 30 minutes here would be
    // offering something no platform will show. 10 and 15 seconds are not a
    // meaningful choice apart — one short option is enough.
    durations: [10, 30, 60] as number[],
  },
  {
    id: 'film' as const,
    aspect: '16:9' as Aspect,
    // Stops at 10 minutes for now: an hour is 360 clips, and nobody should be
    // able to start a $432 render before the pipeline has been proven at a
    // smaller size.
    durations: [60, 180, 300, 600] as number[],
  },
  {
    id: 'square' as const,
    aspect: '1:1' as Aspect,
    durations: [10, 30, 60, 180] as number[],
  },
] as const;

type FormatId = (typeof FORMATS)[number]['id'];

export default function CreateScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { defaultTierId } = useSettings();
  const router = useRouter();
  const toast = useToast();
  const { tiers, durations } = useCatalog();
  const { seed } = useLocalSearchParams<{ seed?: string }>();
  const [prompt, setPrompt] = useState('');

  // "Make like this" from Explore navigates here with a seed prompt to prefill.
  useEffect(() => {
    if (seed) setPrompt(seed);
  }, [seed]);
  const [seconds, setSeconds] = useState(60);
  const [tierId, setTierId] = useState(defaultTierId);
  const [aspect, setAspect] = useState<Aspect>('16:9');
  // Which cinematic variant renders the scenes. mayo always renders cinematic
  // (Higgsfield DoP), so the choice is speed vs finish, not style.
  const [videoModel, setVideoModel] = useState('dop-standard');
  // Three questions in order rather than one panel of controls.
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [format, setFormat] = useState<FormatId>('film');
  const preset = useMemo(() => FORMATS.find((f) => f.id === format) ?? FORMATS[1], [format]);

  // Picking a format sets the shape; the length list narrows to what that
  // format can actually carry.
  const chooseFormat = (id: FormatId) => {
    const next = FORMATS.find((f) => f.id === id) ?? FORMATS[1];
    setFormat(id);
    setAspect(next.aspect);
    if (!next.durations.includes(seconds)) setSeconds(next.durations[0]);
    setStep(1);
  };
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [customUnit, setCustomUnit] = useState<Unit>('min');
  const [submitting, setSubmitting] = useState(false);

  const tier = useMemo(() => tiers.find((x) => x.id === tierId) ?? tiers[0], [tiers, tierId]);
  const { data: genSettings, refetch: refetchSettings } = useQuery(getSettings);
  const priceFactor = genSettings?.byok ? 0.1 : 1;
  const credits = Math.max(1, Math.round(estimateCredits(seconds, tier) * priceFactor));
  // The server owns pricing and timing: it knows the pay-as-you-go bands and
  // the measured seconds-per-scene. The local credit maths above stays as the
  // instant, offline-safe figure while this resolves.
  const estimateReq = useMemo(
    () => ({ prompt: '', seconds, tier: tier.id, aspect, videoModel }),
    [seconds, tier.id, aspect, videoModel],
  );
  const { data: quote, refetch: refetchQuote } = useQuery(() => estimateJob(estimateReq), {
    deps: [estimateReq],
  });

  // What a pull actually refetches here: the price. This screen quotes real
  // money against server-owned bands, so a stale quote is the one thing on it
  // worth distrusting.
  const refresh = async () => {
    await Promise.all([refetchSettings(), refetchQuote()]);
  };

  const planStepByStep = async () => {
    if (submitting) return;
    setSubmitting(true);
    const title = prompt.trim().split('\n')[0].slice(0, 60) || t('create.untitled');
    try {
      const job = await createJob({
        prompt: title,
        seconds,
        tier: tier.id,
        aspect,
        videoModel,
        staged: true,
      });
      router.push(`/jobs/${job.id}/review`);
    } catch (e) {
      toast.show(e instanceof ApiError && e.message ? e.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const generate = async () => {
    if (submitting) return;
    setSubmitting(true);
    const title = prompt.trim().split('\n')[0].slice(0, 60) || t('create.untitled');
    try {
      let job;
      try {
        job = await createJob({ prompt: title, seconds, tier: tier.id, aspect, videoModel });
      } catch (e) {
        // Transient network blip (tunnel/API restarting) — retry once before failing.
        if (e instanceof ApiError && e.status === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          job = await createJob({ prompt: title, seconds, tier: tier.id, aspect, videoModel });
        } else {
          throw e;
        }
      }
      router.push(`/jobs/${job.id}`);
    } catch (e) {
      // 402 carries a human-readable reason (e.g. not enough credits) — show it.
      toast.show(e instanceof ApiError && e.status === 402 && e.message ? e.message : t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const applyCustom = (raw: string, unit: Unit) => {
    const value = raw.replace(/[^0-9.]/g, '');
    setCustomValue(value);
    setCustomUnit(unit);
    const n = parseFloat(value);
    if (!Number.isNaN(n) && n > 0) {
      setSeconds(Math.max(1, Math.round(n * (unit === 'min' ? 60 : 1))));
    }
  };

  // Step 1 — what kind of film. Everything technical follows from this.
  if (step === 0) {
    return (
      <Screen title={t('tab.create')} subtitle={t('create.formatQuestion')} onRefresh={refresh}>
        {FORMATS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => chooseFormat(f.id)}
            style={({ pressed }) => (pressed ? styles.directorPressed : undefined)}>
            <ThemedView type="backgroundElement" style={styles.director}>
              <Ionicons
                name={f.id === 'shorts' ? 'phone-portrait-outline' : f.id === 'film' ? 'film-outline' : 'square-outline'}
                size={20}
                color={theme.text}
              />
              <View style={styles.flex}>
                <ThemedText type="smallBold">{t(`create.format.${f.id}`)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t(`create.format.${f.id}.hint`)}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </ThemedView>
          </Pressable>
        ))}
      </Screen>
    );
  }

  // Step 2 — how long, offering only what this format can carry.
  if (step === 1) {
    return (
      <Screen title={t('create.length')} subtitle={t('create.lengthQuestion')} onRefresh={refresh}>
        <View style={styles.row}>
          {preset.durations.map((sec) => (
            <Chip
              key={sec}
              label={formatDuration(sec)}
              selected={!customMode && seconds === sec}
              onPress={() => {
                setSeconds(sec);
                setCustomMode(false);
              }}
            />
          ))}
          {/* Length lives entirely on this step, custom included — otherwise
              the step is decorative and the real control is elsewhere. */}
          <Chip
            label={t('create.custom')}
            selected={customMode}
            onPress={() => setCustomMode(true)}
          />
        </View>

        {customMode ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('create.customHint')}
            </ThemedText>
            <View style={styles.row}>
              <TextInput
                value={customValue}
                onChangeText={(v) => {
                  setCustomValue(v);
                  applyCustom(v, customUnit);
                }}
                placeholder={t('create.customPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[styles.input, styles.flex, { color: theme.text }]}
              />
              <Chip
                label={t('create.unitSec')}
                selected={customUnit === 'sec'}
                onPress={() => {
                  setCustomUnit('sec');
                  applyCustom(customValue, 'sec');
                }}
              />
              <Chip
                label={t('create.unitMin')}
                selected={customUnit === 'min'}
                onPress={() => {
                  setCustomUnit('min');
                  applyCustom(customValue, 'min');
                }}
              />
            </View>
          </ThemedView>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          {quote
            ? t('create.estimateDetail', {
                scenes: quote.scenes,
                credits: quote.credits,
                eta: formatDuration(quote.etaSeconds),
              })
            : t('create.customHint')}
        </ThemedText>
        <View style={styles.row}>
          <Pressable onPress={() => setStep(0)} style={styles.backBtn}>
            <ThemedText type="smallBold">{t('create.back')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setStep(2)}
            style={({ pressed }) => [
              styles.cta,
              styles.flex,
              { backgroundColor: theme.text },
              pressed && { opacity: 0.85 },
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {t('create.next')}
            </ThemedText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // Step 3 — the idea itself, plus the settings worth changing per film.
  return (
    <Screen title={t('tab.create')} subtitle={t('create.subtitle')} onRefresh={refresh}>
      <Pressable onPress={() => setStep(1)} style={styles.backRow}>
        <Ionicons name="chevron-back" size={16} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {t(`create.format.${format}`)} · {formatDuration(seconds)}
        </ThemedText>
      </Pressable>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">{t('create.prompt')}</ThemedText>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder={t('create.promptPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.input, { color: theme.text }]}
        />
      </ThemedView>

      <Pressable
        onPress={() =>
          router.push({
            pathname: '/director',
            params: { seconds: String(seconds), tier: tier.id, aspect, videoModel },
          })
        }
        style={({ pressed }) => (pressed ? styles.directorPressed : undefined)}>
        <ThemedView type="backgroundElement" style={styles.director}>
          <Ionicons name="film-outline" size={20} color={theme.text} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">{t('create.director')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('create.directorHint')}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </ThemedView>
      </Pressable>

      <ThemedText type="small" themeColor="textSecondary">
        {t('create.examples')}
      </ThemedText>
      <View style={styles.row}>
        {['1', '2', '3', '4'].map((n) => (
          <Chip
            key={n}
            label={t(`create.example.${n}.short`)}
            selected={prompt === t(`create.example.${n}`)}
            onPress={() => setPrompt(t(`create.example.${n}`))}
          />
        ))}
      </View>

      <ThemedText type="smallBold">{t('create.quality')}</ThemedText>
      <View style={styles.row}>
        {tiers.map((x) => (
          <Chip key={x.id} label={x.label} selected={x.id === tierId} onPress={() => setTierId(x.id)} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t(`tier.${tier.id}.blurb`)}
      </ThemedText>

      {/* Cinematic variant — speed vs finish. Times are measured, not guessed. */}
      <ThemedText type="smallBold">{t('create.videoModel')}</ThemedText>
      <View style={styles.row}>
        {(
          [
            ['dop-lite', t('create.model.lite')],
            ['dop-standard', t('create.model.standard')],
            ['dop-turbo', t('create.model.turbo')],
          ] as const
        ).map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            selected={videoModel === id}
            onPress={() => setVideoModel(id)}
          />
        ))}
      </View>

      <ThemedView type="backgroundElement" style={styles.estimate}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('create.estimate')}
        </ThemedText>
        {/* Money first: this is what you pay right now, with no subscription. */}
        <ThemedText type="subtitle">
          {quote ? `$${quote.usd.toFixed(2)}` : t('create.credits', { n: credits })}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('create.estimateMeta', { duration: formatDuration(seconds), tier: tier.label })}
        </ThemedText>
        {quote ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('create.estimateDetail', {
              scenes: quote.scenes,
              credits: quote.credits,
              eta: formatDuration(quote.etaSeconds),
            })}
          </ThemedText>
        ) : null}
      </ThemedView>

      {/* The staged path (ADR 0020): plan and review before anything is paid
          for. Free up to the clips stage, which is also the honest way to show
          someone what they would be buying. */}
      <Pressable
        onPress={planStepByStep}
        disabled={submitting}
        style={({ pressed }) => [
          styles.card,
          styles.staged,
          { borderColor: theme.text },
          pressed && { opacity: 0.85 },
        ]}>
        <ThemedText type="smallBold">{t('create.staged')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('create.stagedHint')}
        </ThemedText>
      </Pressable>

      <Pressable
        onPress={generate}
        disabled={submitting}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: theme.text, opacity: submitting ? 0.5 : pressed ? 0.85 : 1 },
        ]}>
        {submitting ? <ActivityIndicator color={theme.background} /> : null}
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          {submitting ? t('create.generating') : t('create.generate')}
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  director: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  directorPressed: {
    opacity: 0.6,
  },
  flex: {
    flex: 1,
  },
  input: {
    minHeight: 96,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  customBox: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  customInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  estimate: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  staged: { borderWidth: 1, gap: 4 },
  backBtn: { paddingVertical: 14, paddingHorizontal: 20 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cta: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
});
