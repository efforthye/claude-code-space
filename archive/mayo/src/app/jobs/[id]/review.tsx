import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  advanceStage,
  approveAll,
  ApiError,
  approveSegment,
  getClipQuote,
  getJob,
  mediaUrl,
  planBeats,
  reimageSegment,
  renderStills,
  rewriteSegment,
  startClips,
} from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { useQuery } from '@/hooks/use-query';
import { useI18n, useSettings } from '@/settings/settings';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Job, Segment } from '@/api/types';

/**
 * The review screen for the staged flow (ADR 0020).
 *
 * One screen serves every stage because the shape of the work is the same at
 * each: a list of timecoded segments, each individually redoable, and one gate
 * at the end. Building three screens would triple the surface and let them
 * drift apart.
 *
 * Layout follows the window, not the platform: a wide window gets a list beside
 * a detail pane, a narrow one gets the list alone. mayo.im on a laptop was
 * showing a phone column down the middle of a 1440px screen, which wastes both
 * space and clicks.
 */

const WIDE = 900; // below this, one column; above, list + detail side by side

const STAGE_ORDER = ['beats', 'stills', 'clips', 'done'] as const;

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { activeLang } = useSettings();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;

  const [selected, setSelected] = useState(0);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  // Rotating tips for the busy overlay — long waits with a frozen "loading"
  // read as hangs; a moving message reads as work (owner request).
  const [tipIdx, setTipIdx] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const iv = setInterval(() => setTipIdx((n) => (n + 1) % 4), 3500);
    return () => clearInterval(iv);
  }, [busy]);

  const load = useCallback(() => getJob(String(id)), [id]);
  const { data: job, error, refetch } = useQuery<Job>(load, { deps: [id], pollMs: 5000 });

  const segments: Segment[] = useMemo(() => job?.segments ?? [], [job]);
  const stage = job?.stage ?? 'clips';
  // Money is announced BEFORE it is spent: the start button carries the quote.
  const { data: quote } = useQuery(() => getClipQuote(String(id)), {
    enabled: stage === 'clips',
    deps: [id, stage, segments.filter((s) => s.clipKey).length],
  });
  const current = segments[selected];

  // What "approved" means right now, so the gate can be read off the list.
  const approvedStatus =
    stage === 'beats' ? 'approved' : stage === 'stills' ? 'imageApproved' : 'clipApproved';
  const pending = segments.filter((s) => !isAtLeast(s.status, approvedStatus));
  const gateOpen = segments.length > 0 && pending.length === 0;

  // How far the current long stage has got. Counted from the segments
  // themselves rather than a separate progress field, so it cannot drift from
  // what the sheet shows.
  const doneCount = segments.filter((s) =>
    stage === 'stills' ? !!s.imageKey : !!s.clipKey,
  ).length;
  const working =
    segments.length > 0 &&
    ((stage === 'stills' && doneCount < segments.length && segments.some((s) => s.imageKey)) ||
      (stage === 'clips' && doneCount < segments.length && job?.status === 'generating'));
  const ratio = segments.length ? doneCount / segments.length : 0;
  // Measured seconds per piece: a still is quick, a clip is minutes. Shown as a
  // rough remaining time because "3/12" alone does not tell you whether to wait.
  const perPiece = stage === 'stills' ? 12 : 70;
  const remain = Math.max(0, segments.length - doneCount) * perPiece;
  const etaLabel = working
    ? remain >= 60
      ? t('review.etaMin', { n: Math.ceil(remain / 60) })
      : t('review.etaSec', { n: remain })
    : '';

  const run = async (fn: () => Promise<Job>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await refetch();
    } catch (e) {
      // A closed gate answers 409 with which segments are still pending — that
      // message is more useful than anything generic we could substitute.
      toast.show(e instanceof ApiError && e.message ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  // Only a full-screen error when there is NOTHING to show. A transient
  // network blip (app resumed from background, tunnel hiccup) used to replace
  // the whole beat sheet with an error page; now the sheet stays on screen and
  // the 5s poll heals the connection by itself.
  if (error && !job) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.center}>
          <ThemedText>{t('common.error')}</ThemedText>
          <Pressable onPress={() => refetch()} hitSlop={8}>
            <ThemedText type="smallBold" style={styles.retry}>
              {t('common.retry')}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const list = (
    <ScrollView style={wide ? styles.listPane : undefined} contentContainerStyle={styles.listBody}>
      {segments.map((s) => {
        const done = isAtLeast(s.status, approvedStatus);
        return (
          <Pressable
            key={s.index}
            onPress={() => setSelected(s.index)}
            style={[
              styles.row,
              { borderColor: theme.backgroundElement },
              s.index === selected && { borderColor: theme.text },
            ]}>
            <ThemedText type="smallBold" style={styles.time}>
              {fmt(s.startSec)}–{fmt(s.endSec)}
            </ThemedText>
            <ThemedText type="small" numberOfLines={2} style={styles.flex}>
              {s.text || t('review.empty')}
            </ThemedText>
            <Ionicons
              name={done ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={done ? theme.text : theme.textSecondary}
            />
          </Pressable>
        );
      })}
      {segments.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('review.noSegments')}
        </ThemedText>
      ) : null}
    </ScrollView>
  );

  const detail = current ? (
    <ScrollView
      style={wide ? styles.detailPane : undefined}
      contentContainerStyle={styles.detailBody}>
      <ThemedText type="smallBold">
        {t('review.segmentN', { n: current.index + 1, from: fmt(current.startSec), to: fmt(current.endSec) })}
      </ThemedText>

      {current.imageKey ? (
        // imageKey is a bare storage key — mediaUrl needs the /v1/media path
        // (a bare key built a broken host and the still rendered blank).
        <Image
          source={{ uri: mediaUrl(`/v1/media/${current.imageKey}`) }}
          style={styles.still}
          resizeMode="cover"
        />
      ) : null}

      <ThemedText>{current.text}</ThemedText>

      {/*
        The second-by-second breakdown. A paragraph cannot be reviewed at the
        resolution people actually think about video — "the door opens at two
        seconds" is a note you can only give if the plan says when things
        happen, and it is what a revision instruction points at.
      */}
      {current.timeline?.length ? (
        <View style={styles.timeline}>
          {current.timeline.map((m, i) => (
            <View key={`${m.fromSec}-${i}`} style={styles.moment}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.momentAt}>
                {fmt(Math.round(m.fromSec))}–{fmt(Math.round(m.toSec))}
              </ThemedText>
              <ThemedText type="small" style={styles.flex}>
                {m.action}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {stage === 'beats' ? (
        <>
          <TextInput
            value={instruction}
            onChangeText={setInstruction}
            placeholder={t('review.rewritePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundElement }]}
            multiline
          />
          <Action
            label={t('review.rewrite')}
            disabled={busy || !instruction.trim()}
            onPress={() =>
              run(async () => {
                const next = await rewriteSegment(String(id), current.index, instruction.trim());
                setInstruction('');
                return next;
              })
            }
          />
        </>
      ) : null}

      {stage === 'stills' && current.imageKey ? (
        <Action
          label={t('review.reimage')}
          disabled={busy}
          onPress={() => run(() => reimageSegment(String(id), current.index))}
        />
      ) : null}

      {/* Approve only what exists: before the image/clip is rendered there is
          nothing to judge — show WHERE to start instead of a button that 409s. */}
      {stage === 'stills' && !current.imageKey ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('review.needImage')}
        </ThemedText>
      ) : stage === 'clips' && !current.clipKey ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('review.needClip')}
        </ThemedText>
      ) : (
      <Action
        label={isAtLeast(current.status, approvedStatus) ? t('review.approved') : t('review.approve')}
        disabled={busy || isAtLeast(current.status, approvedStatus)}
        primary
        onPress={() =>
          run(async () => {
            const next = await approveSegment(String(id), current.index);
            // Auto-advance to the next unapproved segment — approving N items
            // should be N taps, not 2N (owner: "매번 클릭해야 해서 귀찮").
            const remaining = segments.filter(
              (s) => s.index !== current.index && !isAtLeast(s.status, approvedStatus),
            );
            if (remaining.length) setSelected(remaining[0].index);
            return next;
          })
        }
      />
      )}
    </ScrollView>
  ) : null;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold">{t(`review.stage.${stage}`)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {segments.length - pending.length}/{segments.length}
          </ThemedText>
        </View>

        {/* Stage rail: where you are, and what is still ahead. */}
        <View style={styles.rail}>
          {STAGE_ORDER.map((s) => (
            <View
              key={s}
              style={[
                styles.railDot,
                {
                  backgroundColor:
                    STAGE_ORDER.indexOf(s) <= STAGE_ORDER.indexOf(stage as never)
                      ? theme.text
                      : theme.backgroundElement,
                },
              ]}
            />
          ))}
        </View>

        {/*
          Progress for the two stages that take minutes. Without it the screen
          is identical before and after you press the button, which reads as
          "nothing happened" — the owner pressed Start five times, and until the
          server guard landed that was five renderers billing the same film.
        */}
        {working ? (
          <View style={styles.progress}>
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: theme.text, width: `${Math.round(ratio * 100)}%` },
                ]}
              />
            </View>
            <View style={styles.progressRow}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {t(stage === 'stills' ? 'review.makingStills' : 'review.makingClips', {
                  done: doneCount,
                  total: segments.length,
                })}
              </ThemedText>
              {etaLabel ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {etaLabel}
                </ThemedText>
              ) : null}
            </View>
          </View>
        ) : null}

        {segments.length === 0 && stage === 'clips' ? (
          <View style={styles.center}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('review.legacyJob')}
            </ThemedText>
          </View>
        ) : wide ? (
          <View style={styles.split}>
            {list}
            {detail}
          </View>
        ) : (
          <View style={styles.flex}>
            {list}
            {detail}
          </View>
        )}

        <View style={[styles.footer, { borderColor: theme.backgroundElement }]}>
          {stage === 'beats' && segments.length === 0 ? (
            <Action
              label={t('review.planBeats')}
              primary
              disabled={busy}
              onPress={() => run(() => planBeats(String(id), job?.title ?? ''))}
            />
          ) : stage === 'stills' && !segments.some((s) => s.imageKey) && !busy ? (
            // Stills start on their own when the beats gate clears; this is the
            // repair path for when that background run died.
            <Action
              label={t('review.renderStills')}
              primary
              disabled={busy}
              onPress={() => run(() => renderStills(String(id)))}
            />
          ) : stage === 'clips' &&
            segments.some((s) => !s.clipKey) &&
            job?.status !== 'generating' ? (
            // Also the RESUME path: after a crash/restart the finished clips
            // are kept and rendering skips them, so this only pays for what is
            // still missing.
            // Clips do not render themselves: this button is the paid boundary
            // (POST /clips). Without it the stage sat at 0/N forever — nothing
            // was rendering, so "approve" had nothing to approve.
            <Action
              label={
                t('review.startClips') +
                (quote ? t('review.quoteSuffix', { n: quote.remainingCredits }) : '')
              }
              primary
              disabled={busy}
              onPress={() => run(() => startClips(String(id)))}
            />
          ) : (
            <Action
              // One button, not two states of a dead one. Having read the
              // sheet, the user's next action is the same whether they
              // approved each part or not — so approve what is left and move
              // on, rather than blocking behind twelve separate presses.
              label={gateOpen ? t('review.next') : t('review.approveAllNext')}
              primary
              disabled={busy || segments.length === 0}
              onPress={() =>
                run(async () => {
                  if (!gateOpen) await approveAll(String(id));
                  return advanceStage(String(id));
                })
              }
            />
          )}
        </View>

        {/* Center busy overlay: spinner + rotating tip + "you can leave" note.
            (Owner: no side-of-button spinner; tell people it keeps running.) */}
        {busy ? (
          <View style={styles.busyOverlay} pointerEvents="none">
            <ThemedView type="backgroundElement" style={styles.busyCard}>
              <ActivityIndicator size="large" color={theme.text} />
              <ThemedText type="smallBold" style={styles.busyText}>
                {t(`review.tip.${tipIdx}`)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.busyText}>
                {t('review.busyNote')}
              </ThemedText>
            </ThemedView>
          </View>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

function Action({
  label,
  onPress,
  disabled,
  primary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? theme.text : 'transparent',
          borderColor: theme.backgroundElement,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={primary ? { color: theme.background } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const LADDER = ['draft', 'approved', 'imaged', 'imageApproved', 'rendered', 'clipApproved'];
/** Mirrors the server's linear status ladder — see segments.stage_is_complete. */
const isAtLeast = (status: string, required: string) =>
  LADDER.indexOf(status) >= LADDER.indexOf(required);

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  retry: { textDecorationLine: 'underline' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.two,
  },
  rail: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.two },
  railDot: { flex: 1, height: 3, borderRadius: 2 },
  split: { flex: 1, flexDirection: 'row' },
  listPane: { width: 340, borderRightWidth: StyleSheet.hairlineWidth },
  listBody: { padding: Spacing.screen, gap: Spacing.two },
  detailPane: { flex: 1 },
  detailBody: { padding: Spacing.screen, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two,
  },
  time: { width: 92 },
  still: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  progress: { paddingHorizontal: Spacing.screen, paddingBottom: Spacing.two, gap: Spacing.one },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  timeline: { gap: Spacing.one },
  moment: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  momentAt: { width: 92 },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.two, minHeight: 72 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.screen,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingVertical: 14 },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyCard: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    maxWidth: 320,
  },
  busyText: { textAlign: 'center' },
});
