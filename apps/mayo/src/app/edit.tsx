import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createEdit, listVideos } from '@/api/client';
import { useToast } from '@/components/toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

type Clip = { videoId: string; title: string; start: string; end: string };

export default function EditScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { data: videos } = useQuery(listVideos);
  const editable = (videos ?? []).filter((v) => v.url);

  const [clips, setClips] = useState<Clip[]>([]);
  const [title, setTitle] = useState('');
  const [exporting, setExporting] = useState(false);

  const addClip = (videoId: string, videoTitle: string) =>
    setClips((c) => [...c, { videoId, title: videoTitle, start: '', end: '' }]);
  const removeClip = (i: number) => setClips((c) => c.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setClips((c) => {
      const j = i + dir;
      if (j < 0 || j >= c.length) return c;
      const next = [...c];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const setTrim = (i: number, key: 'start' | 'end', value: string) =>
    setClips((c) => c.map((clip, idx) => (idx === i ? { ...clip, [key]: value.replace(/[^0-9.]/g, '') } : clip)));

  const exportEdit = async () => {
    if (clips.length === 0 || exporting) return;
    setExporting(true);
    try {
      const payload = {
        title: title.trim() || t('edit.defaultTitle'),
        clips: clips.map((c) => {
          const start = parseFloat(c.start);
          const end = parseFloat(c.end);
          return {
            videoId: c.videoId,
            ...(Number.isFinite(start) && start > 0 ? { start } : {}),
            ...(Number.isFinite(end) && end > 0 ? { end } : {}),
          };
        }),
      };
      const video = await createEdit(payload);
      router.replace(`/library/${video.id}`);
      toast.show(t('edit.exported'));
    } catch {
      toast.show(t('common.error'));
      setExporting(false);
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Ionicons name="cut-outline" size={20} color={theme.text} />
            <ThemedText type="smallBold">{t('edit.title')}</ThemedText>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel={t('common.close')}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('edit.subtitle')}
          </ThemedText>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('edit.titlePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />

          <ThemedText type="smallBold">{t('edit.timeline')}</ThemedText>
          {clips.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('edit.timelineEmpty')}
            </ThemedText>
          ) : (
            clips.map((clip, i) => (
              <ThemedView key={`${clip.videoId}-${i}`} type="backgroundElement" style={styles.clipRow}>
                <View style={styles.clipHead}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {i + 1}
                  </ThemedText>
                  <ThemedText type="smallBold" numberOfLines={1} style={styles.flex}>
                    {clip.title}
                  </ThemedText>
                  <Pressable onPress={() => move(i, -1)} hitSlop={8}>
                    <Ionicons name="chevron-up" size={18} color={theme.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => move(i, 1)} hitSlop={8}>
                    <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => removeClip(i)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color="#E5484D" />
                  </Pressable>
                </View>
                <View style={styles.trimRow}>
                  <TextInput
                    value={clip.start}
                    onChangeText={(v) => setTrim(i, 'start', v)}
                    placeholder={t('edit.trimStart')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[styles.trimInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  />
                  <TextInput
                    value={clip.end}
                    onChangeText={(v) => setTrim(i, 'end', v)}
                    placeholder={t('edit.trimEnd')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    style={[styles.trimInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  />
                </View>
              </ThemedView>
            ))
          )}

          <ThemedText type="smallBold">{t('edit.sources')}</ThemedText>
          {editable.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('edit.noSources')}
            </ThemedText>
          ) : (
            editable.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => addClip(v.id, v.title)}
                style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
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

          <Pressable
            onPress={exportEdit}
            disabled={clips.length === 0 || exporting}
            style={({ pressed }) => [
              styles.export,
              {
                backgroundColor: theme.text,
                opacity: clips.length === 0 || exporting ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}>
            <Ionicons name="film-outline" size={18} color={theme.background} />
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {exporting ? t('edit.exporting') : t('edit.export')}
            </ThemedText>
          </Pressable>
        </ScrollView>
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
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  clipRow: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  clipHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  trimRow: { flexDirection: 'row', gap: Spacing.two },
  trimInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  export: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    marginTop: Spacing.two,
  },
  pressed: { opacity: 0.6 },
});
