import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getApiKey } from '@/api/api-key';
import { getApiBaseUrl } from '@/api/base-url';
import { createEdit, listVideos } from '@/api/client';
import type { EditClip, TextPosition, Video } from '@/api/types';
import { useToast } from '@/components/toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

type Clip = {
  key: string;
  videoId: string;
  title: string;
  accent: string;
  url: string; // full playback URL
  duration: number; // source length in seconds (parsed from label)
  start: number;
  end: number;
  text: string;
  textPos: TextPosition;
};

// "1:23" -> 83, "0:12" -> 12, "" -> 0
function parseDuration(label: string): number {
  const parts = label.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function fmt(s: number): string {
  const total = Math.max(0, Math.round(s));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function EditScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { data: videos } = useQuery(listVideos);
  const editable = useMemo(() => (videos ?? []).filter((v) => v.url), [videos]);

  const [clips, setClips] = useState<Clip[]>([]);
  const [selected, setSelected] = useState(0);
  const [title, setTitle] = useState('');
  const [exporting, setExporting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const keyRef = useRef(0);

  // Rotate to landscape while editing (KineMaster/CapCut-style); restore portrait
  // on exit. Native only — no-op on web.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  const sel = clips[selected] as Clip | undefined;

  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    if (!sel?.url) return;
    const key = getApiKey();
    try {
      player.replace({ uri: sel.url, headers: key ? { Authorization: `Bearer ${key}` } : undefined });
      player.currentTime = sel.start;
      player.play();
    } catch {
      // player not ready — ignore
    }
  }, [sel?.url, sel?.start, player]);

  const addClip = (v: Video) => {
    const dur = parseDuration(v.durationLabel) || 0;
    const clip: Clip = {
      key: `c${keyRef.current++}`,
      videoId: v.id,
      title: v.title,
      accent: v.accent,
      url: `${getApiBaseUrl()}${v.url}`,
      duration: dur,
      start: 0,
      end: dur,
      text: '',
      textPos: 'bottom',
    };
    setClips((c) => {
      const next = [...c, clip];
      setSelected(next.length - 1);
      return next;
    });
    setPickerOpen(false);
  };

  const update = (i: number, patch: Partial<Clip>) =>
    setClips((c) => c.map((clip, idx) => (idx === i ? { ...clip, ...patch } : clip)));

  const remove = (i: number) =>
    setClips((c) => {
      const next = c.filter((_, idx) => idx !== i);
      setSelected((s) => Math.max(0, Math.min(s, next.length - 1)));
      return next;
    });

  const move = (i: number, dir: -1 | 1) =>
    setClips((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.length) return c;
      const next = [...c];
      [next[i], next[j]] = [next[j], next[i]];
      setSelected(j);
      return next;
    });

  const duplicate = (i: number) =>
    setClips((c) => {
      const copy = { ...c[i], key: `c${keyRef.current++}` };
      const next = [...c.slice(0, i + 1), copy, ...c.slice(i + 1)];
      setSelected(i + 1);
      return next;
    });

  // Split the selected clip at its trimmed midpoint into two adjacent clips.
  const split = (i: number) =>
    setClips((c) => {
      const clip = c[i];
      const mid = clip.end > clip.start ? (clip.start + clip.end) / 2 : clip.start;
      if (mid <= clip.start || mid >= clip.end) return c;
      const a: Clip = { ...clip, end: mid };
      const b: Clip = { ...clip, key: `c${keyRef.current++}`, start: mid };
      const next = [...c.slice(0, i), a, b, ...c.slice(i + 1)];
      setSelected(i);
      return next;
    });

  const nudge = (i: number, field: 'start' | 'end', delta: number) =>
    setClips((c) =>
      c.map((clip, idx) => {
        if (idx !== i) return clip;
        if (field === 'start') {
          const start = Math.max(0, Math.min(clip.start + delta, clip.end - 1));
          return { ...clip, start };
        }
        const end = Math.max(clip.start + 1, Math.min(clip.end + delta, clip.duration || clip.end + delta));
        return { ...clip, end };
      }),
    );

  const exportEdit = async () => {
    if (clips.length === 0 || exporting) return;
    setExporting(true);
    try {
      const payload = {
        title: title.trim() || t('edit.defaultTitle'),
        clips: clips.map<EditClip>((c) => ({
          videoId: c.videoId,
          ...(c.start > 0 ? { start: c.start } : {}),
          ...(c.end > 0 && c.end > c.start ? { end: c.end } : {}),
          ...(c.text.trim() ? { text: c.text.trim(), textPosition: c.textPos } : {}),
        })),
      };
      const video = await createEdit(payload);
      router.replace(`/library/${video.id}`);
      toast.show(t('edit.exported'));
    } catch {
      toast.show(t('common.error'));
      setExporting(false);
    }
  };

  const posOptions: TextPosition[] = ['top', 'center', 'bottom'];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('edit.titlePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.titleInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Pressable
            onPress={exportEdit}
            disabled={clips.length === 0 || exporting}
            style={({ pressed }) => [
              styles.exportBtn,
              { backgroundColor: theme.text, opacity: clips.length === 0 || exporting ? 0.4 : pressed ? 0.85 : 1 },
            ]}>
            <Ionicons name="checkmark" size={16} color={theme.background} />
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {exporting ? t('edit.exporting') : t('edit.export')}
            </ThemedText>
          </Pressable>
        </View>

        {/* Main: preview (left) + inspector (right) */}
        <View style={styles.main}>
          <View style={styles.previewWrap}>
            {sel?.url ? (
              <VideoView player={player} style={styles.preview} contentFit="contain" nativeControls={false} />
            ) : (
              <View style={[styles.preview, styles.previewEmpty, { borderColor: theme.backgroundSelected }]}>
                <Ionicons name="film-outline" size={28} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  {clips.length === 0 ? t('edit.noClips') : t('edit.selectClip')}
                </ThemedText>
              </View>
            )}
          </View>

          <ScrollView style={styles.inspector} contentContainerStyle={styles.inspectorInner}>
            {sel ? (
              <>
                <ThemedText type="smallBold" numberOfLines={1}>
                  {t('edit.clipN', { n: selected + 1 })} · {sel.title}
                </ThemedText>

                {/* Trim */}
                <ThemedText type="small" themeColor="textSecondary">
                  {t('edit.trimHint')} · {fmt(sel.start)} – {fmt(sel.end)}
                </ThemedText>
                <View style={styles.trimGrid}>
                  <Stepper label={t('edit.trimStart')} value={fmt(sel.start)} onMinus={() => nudge(selected, 'start', -1)} onPlus={() => nudge(selected, 'start', 1)} theme={theme} />
                  <Stepper label={t('edit.trimEnd')} value={fmt(sel.end)} onMinus={() => nudge(selected, 'end', -1)} onPlus={() => nudge(selected, 'end', 1)} theme={theme} />
                </View>

                {/* Ops */}
                <View style={styles.opsRow}>
                  <Op icon="cut-outline" label={t('edit.split')} onPress={() => split(selected)} theme={theme} />
                  <Op icon="copy-outline" label={t('edit.duplicate')} onPress={() => duplicate(selected)} theme={theme} />
                  <Op icon="chevron-back" label="" onPress={() => move(selected, -1)} theme={theme} />
                  <Op icon="chevron-forward" label="" onPress={() => move(selected, 1)} theme={theme} />
                  <Op icon="trash-outline" label={t('edit.delete')} onPress={() => remove(selected)} theme={theme} danger />
                </View>

                {/* Caption */}
                <ThemedText type="smallBold">{t('edit.text')}</ThemedText>
                <TextInput
                  value={sel.text}
                  onChangeText={(v) => update(selected, { text: v })}
                  placeholder={t('edit.textPlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.textInput, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                />
                <View style={styles.posRow}>
                  {posOptions.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => update(selected, { textPos: p })}
                      style={[
                        styles.posChip,
                        { borderColor: sel.textPos === p ? theme.text : theme.backgroundSelected },
                      ]}>
                      <ThemedText type="small" themeColor={sel.textPos === p ? 'text' : 'textSecondary'}>
                        {t(`edit.pos${p[0].toUpperCase()}${p.slice(1)}` as 'edit.posTop')}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                <Pressable onPress={() => toast.show(t('edit.audioSoon'))} style={[styles.audioBtn, { borderColor: theme.backgroundSelected }]}>
                  <Ionicons name="musical-notes-outline" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('edit.audio')}
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {clips.length === 0 ? t('edit.noClips') : t('edit.selectClip')}
              </ThemedText>
            )}
          </ScrollView>
        </View>

        {/* Timeline filmstrip */}
        <View style={[styles.timeline, { borderTopColor: theme.backgroundSelected }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timelineInner}>
            {clips.map((clip, i) => (
              <Pressable
                key={clip.key}
                onPress={() => setSelected(i)}
                style={[
                  styles.tlClip,
                  { backgroundColor: clip.accent, borderColor: i === selected ? theme.text : 'transparent' },
                ]}>
                <ThemedText type="small" numberOfLines={1} style={styles.tlTitle}>
                  {clip.title}
                </ThemedText>
                <View style={styles.tlDur}>
                  <ThemedText type="small" style={styles.tlDurText}>
                    {fmt(Math.max(0, clip.end - clip.start))}
                  </ThemedText>
                </View>
                {clip.text.trim() ? <Ionicons name="text" size={12} color="#fff" style={styles.tlText} /> : null}
              </Pressable>
            ))}
            <Pressable
              onPress={() => setPickerOpen(true)}
              style={[styles.tlAdd, { borderColor: theme.backgroundSelected }]}>
              <Ionicons name="add" size={26} color={theme.text} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('edit.addClip')}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Source picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)} />
        <ThemedView type="background" style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ThemedText type="smallBold">{t('edit.sources')}</ThemedText>
          <ScrollView contentContainerStyle={styles.sourceList}>
            {editable.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('edit.noSources')}
              </ThemedText>
            ) : (
              editable.map((v) => (
                <Pressable key={v.id} onPress={() => addClip(v)}>
                  <ThemedView type="backgroundElement" style={styles.sourceRow}>
                    <View style={[styles.thumb, { backgroundColor: v.accent }]}>
                      <Ionicons name="add" size={20} color="#ffffff" />
                    </View>
                    <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                      {v.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {v.durationLabel}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))
            )}
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  theme,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.stepper}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.stepperRow}>
        <Pressable onPress={onMinus} style={[styles.stepBtn, { borderColor: theme.backgroundSelected }]}>
          <Ionicons name="remove" size={16} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold" style={styles.stepVal}>
          {value}
        </ThemedText>
        <Pressable onPress={onPlus} style={[styles.stepBtn, { borderColor: theme.backgroundSelected }]}>
          <Ionicons name="add" size={16} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

function Op({
  icon,
  label,
  onPress,
  theme,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.op, { borderColor: theme.backgroundSelected }]}>
      <Ionicons name={icon} size={18} color={danger ? '#E5484D' : theme.text} />
      {label ? (
        <ThemedText type="small" themeColor={danger ? undefined : 'textSecondary'} style={danger ? { color: '#E5484D' } : undefined}>
          {label}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  titleInput: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  main: { flex: 1, flexDirection: 'row', paddingHorizontal: Spacing.four, gap: Spacing.three },
  previewWrap: { flex: 1.3, justifyContent: 'center' },
  preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: Spacing.three, backgroundColor: '#000' },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, borderWidth: 1 },
  inspector: { flex: 1 },
  inspectorInner: { gap: Spacing.two, paddingBottom: Spacing.three },
  trimGrid: { flexDirection: 'row', gap: Spacing.two },
  stepper: { flex: 1, gap: Spacing.one },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { padding: Spacing.two, borderWidth: StyleSheet.hairlineWidth, borderRadius: Spacing.two },
  stepVal: { minWidth: 44, textAlign: 'center' },
  opsRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  op: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
  },
  textInput: {
    fontSize: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  posRow: { flexDirection: 'row', gap: Spacing.two },
  posChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: 1,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
  },
  timeline: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: Spacing.two },
  timelineInner: { gap: Spacing.two, paddingHorizontal: Spacing.four, alignItems: 'center' },
  tlClip: {
    width: 96,
    height: 60,
    borderRadius: Spacing.two,
    borderWidth: 2,
    padding: Spacing.one,
    justifyContent: 'space-between',
  },
  tlTitle: { color: '#fff' },
  tlDur: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 4 },
  tlDurText: { color: '#fff' },
  tlText: { position: 'absolute', right: 4, top: 4 },
  tlAdd: {
    width: 84,
    height: 60,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
    maxHeight: '70%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    marginBottom: Spacing.two,
  },
  sourceList: { gap: Spacing.two, paddingBottom: Spacing.two },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  thumb: { width: 44, height: 44, borderRadius: Spacing.three, alignItems: 'center', justifyContent: 'center' },
});
