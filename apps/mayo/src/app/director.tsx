import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { createJob, directorChat } from '@/api/client';
import type { DirectorMessage, Screenplay } from '@/api/types';
import { useToast } from '@/components/toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, useSettings } from '@/settings/settings';

export default function DirectorScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { defaultTierId } = useSettings();
  const params = useLocalSearchParams<{ seconds?: string; tier?: string }>();
  const seconds = Math.max(1, parseInt(params.seconds ?? '', 10) || 60);
  const tier = params.tier || defaultTierId;

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);
  const [messages, setMessages] = useState<DirectorMessage[]>([
    { role: 'director', content: t('director.greeting') },
  ]);

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
      const job = await createJob({ prompt, seconds, tier });
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
            <ThemedText type="smallBold">{t('director.title')}</ThemedText>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel={t('common.close')}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
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
