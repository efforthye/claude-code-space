import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getVideo, publishVideo, youtubeConnect, youtubeStatus } from '@/api/client';
import type { Visibility } from '@/api/types';
import { Chip } from '@/components/chip';
import { useToast } from '@/components/toast';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuery } from '@/hooks/use-query';
import { useI18n } from '@/settings/settings';

export default function PublishScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const videoId = id ?? '';
  const { data: video } = useQuery(() => getVideo(videoId), {
    enabled: !!videoId,
    deps: [videoId],
  });
  // Real upload requires the user's YouTube grant; otherwise publish is a no-op.
  const { data: yt, refetch: refetchYt } = useQuery(youtubeStatus);
  const connectYoutube = async () => {
    try {
      const { url } = await youtubeConnect();
      await WebBrowser.openBrowserAsync(url);
      refetchYt();
    } catch {
      toast.show(t('publish.connectSignIn'));
    }
  };

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [submitting, setSubmitting] = useState(false);

  // Prefill the title from the video once it loads, unless the user already typed.
  const [touched, setTouched] = useState(false);
  if (video && !touched && title === '') {
    setTitle(video.title);
  }

  const submit = async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      if (videoId) await publishVideo(videoId, { title, description, visibility });
      router.back();
      toast.show(t('toast.published'));
    } catch {
      toast.show(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const visOptions: { id: Visibility; label: string }[] = [
    { id: 'private', label: t('vis.private') },
    { id: 'unlisted', label: t('vis.unlisted') },
    { id: 'public', label: t('vis.public') },
  ];

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.titleWrap}>
            <Ionicons name="logo-youtube" size={22} color="#FF0000" />
            <ThemedText type="smallBold">{t('publish.title')}</ThemedText>
          </View>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel={t('publish.cancel')}
            style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('publish.subtitle')}
          </ThemedText>

          {yt && yt.configured && !yt.connected ? (
            <Pressable onPress={connectYoutube}>
              <ThemedView type="backgroundElement" style={styles.connectCard}>
                <Ionicons name="logo-youtube" size={20} color="#FF0000" />
                <View style={styles.flex1}>
                  <ThemedText type="smallBold">{t('publish.connect')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('publish.connectHint')}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </ThemedView>
            </Pressable>
          ) : null}
          {yt?.connected ? (
            <ThemedText type="small" themeColor="textSecondary">
              ✅ {t('publish.connected')}
            </ThemedText>
          ) : null}

          <ThemedText type="smallBold">{t('publish.videoTitle')}</ThemedText>
          <TextInput
            value={title}
            onChangeText={(v) => {
              setTouched(true);
              setTitle(v);
            }}
            placeholder={t('publish.videoTitlePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
          />

          <ThemedText type="smallBold">{t('publish.description')}</ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('publish.descriptionPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[
              styles.input,
              styles.multiline,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
          />

          <ThemedText type="smallBold">{t('publish.visibility')}</ThemedText>
          <View style={styles.row}>
            {visOptions.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                selected={visibility === o.id}
                onPress={() => setVisibility(o.id)}
              />
            ))}
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {t('publish.quotaNote')}
          </ThemedText>

          <Pressable
            onPress={submit}
            disabled={!title.trim() || submitting}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: theme.text,
                opacity: !title.trim() || submitting ? 0.4 : pressed ? 0.7 : 1,
              },
            ]}>
            <Ionicons name="logo-youtube" size={20} color={theme.background} />
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {t('publish.button')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  connectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  flex1: { flex: 1 },
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
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    marginTop: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
