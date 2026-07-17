import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TIERS } from '@/api/catalog';
import { createJob, directorChat, getDirectors, getSettings, getVideo, putSettings } from '@/api/client';
import type {
  DirectorMessage,
  DirectorModel,
  PlannerBackend,
  RuntimeSettings,
  Screenplay,
} from '@/api/types';
import { useToast } from '@/components/toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n, useSettings } from '@/settings/settings';

// Context messages carry the film being revised; they feed the model but stay
// out of the visible transcript.
const HIDDEN_PREFIX = '[영상 수정 컨텍스트]';

export default function DirectorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { defaultTierId } = useSettings();
  const params = useLocalSearchParams<{ seconds?: string; tier?: string; videoId?: string }>();
  // Adjustable in-chat: the director replans against whatever is current.
  const [seconds, setSeconds] = useState(Math.max(1, parseInt(params.seconds ?? '', 10) || 60));
  const [tier, setTier] = useState(params.tier || defaultTierId);

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);
  const [messages, setMessages] = useState<DirectorMessage[]>([
    { role: 'director', content: t('director.greeting') },
  ]);

  // REVISION MODE: opened from a library video — load its scene recipe as hidden
  // context so the user can say "2번 장면을 밤으로 바꿔줘" and the director
  // revises the existing screenplay instead of starting from scratch.
  const revising = !!params.videoId;
  useEffect(() => {
    if (!params.videoId) return;
    let alive = true;
    getVideo(params.videoId)
      .then((v) => {
        if (!alive) return;
        const scenes = (v.scenePrompts ?? []).map((p, i) => `${i + 1}. ${p}`).join('\n');
        const context =
          `${HIDDEN_PREFIX} 기존 영상을 수정합니다. 제목: ${v.title}\n` +
          (v.prompt ? `원본 프롬프트: ${v.prompt}\n` : '') +
          (scenes ? `기존 씬 구성:\n${scenes}\n` : '') +
          '사용자가 말하는 수정사항을 반영해 이 구성을 바탕으로 screenplay를 갱신하세요.';
        setMessages([
          { role: 'user', content: context },
          { role: 'director', content: t('director.reviseGreeting', { title: v.title }) },
        ]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.videoId]);

  // Lift the input above the keyboard ourselves — KeyboardAvoidingView is
  // unreliable inside a modal (its offset math is off vs the modal's top gap),
  // which left the input hidden behind the keyboard. Padding by the measured
  // keyboard height always works, modal or not.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKbHeight(e.endCoordinates?.height ?? 0);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  const [input, setInput] = useState('');
  const [screenplay, setScreenplay] = useState<Screenplay | null>(null);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: DirectorMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      // Only user/director turns are meaningful to the backend; the greeting is
      // a local director turn so it's fine to include.
      const turn = await directorChat({ messages: next, seconds, tier });
      setMessages((m) => [...m, { role: 'director', content: turn.reply }]);
      if (turn.screenplay) setScreenplay(turn.screenplay);
      setReady(!!turn.ready);
    } catch {
      setMessages((m) => [...m, { role: 'director', content: t('director.error') }]);
    } finally {
      setSending(false);
    }
  };

  const generate = async () => {
    if (!screenplay || generating) return;
    setGenerating(true);
    try {
      const prompt = `${screenplay.title}\n${screenplay.logline}`.trim();
      const scenePrompts = screenplay.scenes.map((s) => s.prompt).filter(Boolean);
      const job = await createJob({
        prompt,
        seconds,
        tier,
        scenePrompts: scenePrompts.length ? scenePrompts : undefined,
      });
      router.replace(`/jobs/${job.id}`);
      toast.show(t('director.generating'));
    } catch {
      toast.show(t('common.error'));
      setGenerating(false);
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Ionicons name="film-outline" size={20} color={theme.text} />
            <ThemedText type="smallBold">{revising ? t('director.reviseTitle') : t('director.title')}</ThemedText>
          </View>
          <View style={styles.topRight}>
            <DirectorPicker />
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel={t('common.close')}
              style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
        </View>

        <View style={styles.optionsRow}>
          {[10, 30, 60, 180].map((s) => (
            <Pressable
              key={s}
              onPress={() => setSeconds(s)}
              style={[
                styles.optChip,
                { borderColor: seconds === s ? theme.text : theme.backgroundSelected },
              ]}>
              <ThemedText type="small" themeColor={seconds === s ? 'text' : 'textSecondary'}>
                {s < 60 ? `${s}s` : `${s / 60}m`}
              </ThemedText>
            </Pressable>
          ))}
          <View style={styles.optDivider} />
          {TIERS.map((x) => (
            <Pressable
              key={x.id}
              onPress={() => setTier(x.id)}
              style={[
                styles.optChip,
                { borderColor: tier === x.id ? theme.text : theme.backgroundSelected },
              ]}>
              <ThemedText type="small" themeColor={tier === x.id ? 'text' : 'textSecondary'}>
                {x.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={[styles.flex, { paddingBottom: kbHeight > 0 ? kbHeight : insets.bottom }]}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.map((m, i) => {
              if (m.content.startsWith(HIDDEN_PREFIX)) return null;
              const mine = m.role === 'user';
              return (
                <View
                  key={i}
                  style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: mine ? theme.text : theme.backgroundElement,
                        borderBottomRightRadius: mine ? Spacing.one : Spacing.four,
                        borderBottomLeftRadius: mine ? Spacing.four : Spacing.one,
                      },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: mine ? theme.background : theme.text }}>
                      {m.content}
                    </ThemedText>
                  </View>
                </View>
              );
            })}

            {sending ? (
              <View style={[styles.bubbleRow, { justifyContent: 'flex-start' }]}>
                <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('director.thinking')}
                  </ThemedText>
                </View>
              </View>
            ) : null}

            {screenplay ? (
              <ThemedView type="backgroundElement" style={styles.draft}>
                <View style={styles.draftHead}>
                  <Ionicons name="reader-outline" size={16} color={theme.textSecondary} />
                  <ThemedText type="smallBold" style={styles.flex}>
                    {t('director.draft')}
                  </ThemedText>
                  {ready ? (
                    <View style={[styles.readyPill, { backgroundColor: theme.backgroundSelected }]}>
                      <ThemedText type="small" style={{ color: theme.text }}>
                        {t('director.ready')}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText type="subtitle">{screenplay.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {screenplay.logline}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('director.sceneCount', { n: screenplay.scenes.length, sec: seconds })}
                </ThemedText>
                {screenplay.scenes.slice(0, 6).map((s) => (
                  <View key={s.index} style={styles.sceneRow}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.sceneNo}>
                      {s.index + 1}
                    </ThemedText>
                    <ThemedText type="small" style={styles.flex}>
                      {s.heading}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {s.seconds}s
                    </ThemedText>
                  </View>
                ))}
                {screenplay.scenes.length > 6 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('director.moreScenes', { n: screenplay.scenes.length - 6 })}
                  </ThemedText>
                ) : null}

                <Pressable
                  onPress={generate}
                  disabled={generating}
                  style={({ pressed }) => [
                    styles.generate,
                    { backgroundColor: theme.text, opacity: generating ? 0.5 : pressed ? 0.85 : 1 },
                  ]}>
                  <Ionicons name="sparkles-outline" size={18} color={theme.background} />
                  <ThemedText type="smallBold" style={{ color: theme.background }}>
                    {t('director.generate')}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            ) : null}
          </ScrollView>

          <View style={[styles.inputBar, { borderTopColor: theme.backgroundSelected }]}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t('director.inputPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundElement },
              ]}
              onSubmitEditing={send}
            />
            <Pressable
              onPress={send}
              disabled={!input.trim() || sending}
              accessibilityLabel={t('director.send')}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: theme.text,
                  opacity: !input.trim() || sending ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}>
              <Ionicons name="arrow-up" size={20} color={theme.background} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Header control that lets the user pick which AI writes the screenplay
 * (Basic / Local LLM / a Claude model). Persists via /v1/settings so the choice
 * sticks across sessions and the whole app uses it. */
function DirectorPicker() {
  const theme = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<RuntimeSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: settings } = useQuery(() => getSettings());
  const { data: directors } = useQuery(() => getDirectors());

  useEffect(() => {
    if (settings && !sel) setSel(settings);
  }, [settings, sel]);

  const backend: PlannerBackend = (sel?.plannerBackend ?? 'mock') as PlannerBackend;
  const label =
    backend === 'claude'
      ? directors?.find((d) => d.id === sel?.directorModel)?.name ?? 'Claude'
      : backend === 'local'
        ? t('director.backendLocal')
        : t('director.backendMock');

  const choose = async (next: PlannerBackend, model?: string) => {
    if (!sel || !settings || saving) return; // wait for server state before writing
    const updated: RuntimeSettings = {
      ...sel,
      plannerBackend: next,
      directorModel: model ?? sel.directorModel,
    };
    setSel(updated);
    setOpen(false);
    setSaving(true);
    try {
      const saved = await putSettings(updated);
      setSel(saved);
      toast.show(t('director.saved'));
    } catch {
      setSel(sel); // revert on failure
      toast.show(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const isSel = (b: PlannerBackend, model?: string) =>
    backend === b && (b !== 'claude' || sel?.directorModel === model);

  const Row = ({
    b,
    model,
    title,
    desc,
    free,
  }: {
    b: PlannerBackend;
    model?: string;
    title: string;
    desc: string;
    free?: boolean;
  }) => (
    <Pressable
      onPress={() => choose(b, model)}
      style={({ pressed }) => [
        styles.pickRow,
        { borderColor: isSel(b, model) ? theme.text : theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <View style={styles.flex}>
        <View style={styles.pickRowHead}>
          <ThemedText type="smallBold">{title}</ThemedText>
          {free ? (
            <View style={[styles.freeTag, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('director.free')}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {desc}
        </ThemedText>
      </View>
      {isSel(b, model) ? <Ionicons name="checkmark-circle" size={20} color={theme.text} /> : null}
    </Pressable>
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="sparkles" size={13} color={theme.textSecondary} />
        <ThemedText type="small" numberOfLines={1} style={styles.pillLabel}>
          {label}
        </ThemedText>
        <Ionicons name="chevron-down" size={13} color={theme.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <ThemedView type="background" style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ThemedText type="subtitle">{t('director.pickTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pickHint}>
            {t('director.pickHint')}
          </ThemedText>
          {!settings ? (
            <ActivityIndicator style={styles.pickLoading} />
          ) : (
            <ScrollView style={styles.pickList} contentContainerStyle={styles.pickListInner}>
              <Row
                b="mock"
                title={t('director.backendMock')}
                desc={t('director.backendMockDesc')}
                free
              />
              <Row
                b="local"
                title={t('director.backendLocal')}
                desc={t('director.backendLocalDesc')}
                free
              />
              {(directors ?? []).map((d: DirectorModel) => (
                <Row key={d.id} b="claude" model={d.id} title={d.name} desc={d.blurb} />
              ))}
            </ScrollView>
          )}
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
    maxWidth: 150,
  },
  pillLabel: { flexShrink: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
    maxHeight: '80%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    marginBottom: Spacing.two,
  },
  pickHint: { marginBottom: Spacing.two },
  pickLoading: { padding: Spacing.five },
  pickList: { flexGrow: 0 },
  pickListInner: { gap: Spacing.two, paddingBottom: Spacing.two },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: 1,
  },
  pickRowHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  freeTag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 1,
    borderRadius: Spacing.two,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  optChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    borderRadius: Spacing.four,
    borderWidth: 1,
  },
  optDivider: { width: 1, height: 16, backgroundColor: 'rgba(128,128,128,0.35)' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  messages: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  bubbleRow: { flexDirection: 'row' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  draft: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
    marginTop: Spacing.two,
  },
  draftHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  readyPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.three,
  },
  sceneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  sceneNo: { minWidth: 16 },
  generate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    marginTop: Spacing.two,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
});
