import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
  ApiError,
  approveSegment,
  getJob,
  mediaUrl,
  planBeats,
  reimageSegment,
  renderStills,
  rewriteSegment,
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

  const load = useCallback(() => getJob(String(id)), [id]);
  const { data: job, error, refetch } = useQuery<Job>(load, { deps: [id], pollMs: 5000 });

  const segments: Segment[] = useMemo(() => job?.segments ?? [], [job]);
  const stage = job?.stage ?? 'clips';
  const current = segments[selected];

  // What "approved" means right now, so the gate can be read off the list.
  const approvedStatus =
    stage === 'beats' ? 'approved' : stage === 'stills' ? 'imageApproved' : 'clipApproved';
  const pending = segments.filter((s) => !isAtLeast(s.status, approvedStatus));
  const gateOpen = segments.length > 0 && pending.length === 0;

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

  if (error) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.center}>
          <ThemedText>{t('common.error')}</ThemedText>
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
        <Image
          source={{ uri: mediaUrl(current.imageKey) }}
          style={styles.still}
          resizeMode="cover"
        />
      ) : null}

      <ThemedText>{current.text}</ThemedText>

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

      {stage === 'stills' ? (
        <Action
          label={t('review.reimage')}
          disabled={busy}
          onPress={() => run(() => reimageSegment(String(id), current.index))}
        />
      ) : null}

      <Action
        label={isAtLeast(current.status, approvedStatus) ? t('review.approved') : t('review.approve')}
        disabled={busy || isAtLeast(current.status, approvedStatus)}
        primary
        onPress={() => run(() => approveSegment(String(id), current.index))}
      />
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
          ) : stage === 'stills' && !segments.some((s) => s.imageKey) ? (
            <Action
              label={t('review.renderStills')}
              primary
              disabled={busy}
              onPress={() => run(() => renderStills(String(id)))}
            />
          ) : (
            <Action
              label={gateOpen ? t('review.next') : t('review.nextBlocked', { n: pending.length })}
              primary
              disabled={busy || !gateOpen}
              onPress={() => run(() => advanceStage(String(id)))}
            />
          )}
          {busy ? <ActivityIndicator color={theme.text} /> : null}
        </View>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
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
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.two, minHeight: 72 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.screen,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingVertical: 14 },
});
