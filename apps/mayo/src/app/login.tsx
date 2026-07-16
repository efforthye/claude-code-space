import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { GOOGLE_CLIENT_ID, useAuth } from '@/auth/auth';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/settings/settings';

// Completes the browser-based auth round trip (no-op where unsupported).
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const toast = useToast();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  // Google sign-in — enabled only when a client id is baked into the build.
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    GOOGLE_CLIENT_ID
      ? { clientId: GOOGLE_CLIENT_ID, webClientId: GOOGLE_CLIENT_ID }
      : { clientId: 'unconfigured.apps.googleusercontent.com' },
  );

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = (response.params as { id_token?: string }).id_token;
    if (!idToken) return;
    setBusy(true);
    signInWithGoogle(idToken)
      .then(() => {
        toast.show(t('auth.welcome'));
        router.back();
      })
      .catch(() => toast.show(t('auth.googleFailed')))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const submit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(email, password, name);
      toast.show(t('auth.welcome'));
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) toast.show(t('auth.wrongCredentials'));
      else if (e instanceof ApiError && e.status === 409) toast.show(t('auth.emailTaken'));
      else if (e instanceof ApiError && e.status === 422) toast.show(t('auth.invalidInput'));
      else toast.show(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.topBar}>
          <ThemedText type="smallBold">
            {mode === 'login' ? t('auth.signIn') : t('auth.signUp')}
          </ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Ionicons name="person-circle-outline" size={56} color={theme.textSecondary} style={styles.icon} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.blurb}>
            {t('auth.blurb')}
          </ThemedText>

          {mode === 'register' ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('auth.name')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.email')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.password')}
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            onSubmitEditing={submit}
          />

          <Pressable
            onPress={submit}
            disabled={busy || !email.trim() || !password}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: theme.text,
                opacity: busy || !email.trim() || !password ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}>
            {busy ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {mode === 'login' ? t('auth.signIn') : t('auth.signUp')}
              </ThemedText>
            )}
          </Pressable>

          {GOOGLE_CLIENT_ID ? (
            <Pressable
              onPress={() => promptAsync()}
              disabled={!request || busy}
              style={({ pressed }) => [
                styles.google,
                { borderColor: theme.backgroundSelected, opacity: !request || busy ? 0.4 : pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="logo-google" size={18} color={theme.text} />
              <ThemedText type="smallBold">{t('auth.google')}</ThemedText>
            </Pressable>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.blurb}>
              {t('auth.googleUnconfigured')}
            </ThemedText>
          )}

          <Pressable onPress={() => setMode((m) => (m === 'login' ? 'register' : 'login'))} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.switch}>
              {mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  icon: { alignSelf: 'center' },
  blurb: { textAlign: 'center' },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    minHeight: 46,
  },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.five,
    borderWidth: 1,
  },
  switch: { textAlign: 'center', textDecorationLine: 'underline', paddingVertical: Spacing.two },
});
