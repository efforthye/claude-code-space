import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ApiError,
  authApple,
  githubLoginStart,
  githubLoginResult,
  googleLoginStart,
  googleLoginResult,
  resetComplete,
  resetStart,
} from '@/api/client';
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
  const { signIn, signUp, adoptSession } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  // Password reset: request a code by email, then enter code + new password.
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('');

  const sendResetCode = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    try {
      await resetStart(email.trim());
      setResetSent(true);
      toast.show(t('auth.resetSent'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 501) toast.show(t('auth.resetUnavailable'));
      else toast.show(t('auth.resetFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (busy || !email.trim() || !resetCode.trim() || password.length < 8) return;
    setBusy(true);
    try {
      const res = await resetComplete(email.trim(), resetCode.trim(), password);
      await adoptSession(res.token, res.user);
      toast.show(t('auth.resetDone'));
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) toast.show(t('auth.resetWrongCode'));
      else toast.show(t('auth.resetFailed'));
    } finally {
      setBusy(false);
    }
  };

  // Server-driven SNS login (Expo Go-safe, used by native Google and GitHub on
  // every platform): get a one-time loginId + consent URL from the API, open
  // the browser, and poll until the server has minted a session (the provider
  // redirects to the API, not the app).
  const snsLogin = async (
    start: () => Promise<{ loginId: string; url: string }>,
    poll: (loginId: string) => Promise<{ status: string; token?: string | null; user?: any } | null>,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const { loginId, url } = await start();
      WebBrowser.openBrowserAsync(url).catch(() => {});
      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const res = await poll(loginId).catch(() => null);
        if (res?.status === 'ready' && res.token && res.user) {
          if (Platform.OS !== 'web') WebBrowser.dismissBrowser().catch(() => {});
          await adoptSession(res.token, res.user);
          toast.show(t('auth.welcome'));
          router.back();
          return;
        }
      }
      toast.show(t('auth.googleFailed'));
    } catch (e) {
      // 400 = provider not configured on the server — show its reason.
      toast.show(e instanceof ApiError && e.status === 400 && e.message ? e.message : t('auth.googleFailed'));
    } finally {
      setBusy(false);
    }
  };
  const nativeGoogle = () => snsLogin(googleLoginStart, googleLoginResult);
  const githubLogin = () => snsLogin(githubLoginStart, githubLoginResult);

  // Apple sign-in — native module (works inside Expo Go on iOS); the resulting
  // identityToken is verified server-side against Apple's JWKS.
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);
  const appleLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!cred.identityToken) throw new Error('no identity token');
      const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
      const res = await authApple(cred.identityToken, name);
      await adoptSession(res.token, res.user);
      toast.show(t('auth.welcome'));
      router.back();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== 'ERR_REQUEST_CANCELED') {
        toast.show(e instanceof ApiError && e.message ? e.message : t('auth.appleFailed'));
      }
    } finally {
      setBusy(false);
    }
  };


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
            {mode === 'login' ? t('auth.signIn') : mode === 'register' ? t('auth.signUp') : t('auth.resetTitle')}
          </ThemedText>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
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
          {mode === 'reset' && resetSent ? (
            <TextInput
              value={resetCode}
              onChangeText={setResetCode}
              placeholder={t('auth.resetCode')}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          ) : null}
          {mode !== 'reset' || resetSent ? (
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'reset' ? t('auth.newPassword') : t('auth.password')}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              onSubmitEditing={mode === 'reset' ? submitReset : submit}
            />
          ) : null}

          {mode === 'reset' ? (
            <Pressable
              onPress={resetSent ? submitReset : sendResetCode}
              disabled={busy || !email.trim() || (resetSent && (!resetCode.trim() || password.length < 8))}
              style={({ pressed }) => [
                styles.primary,
                {
                  backgroundColor: theme.text,
                  opacity:
                    busy || !email.trim() || (resetSent && (!resetCode.trim() || password.length < 8))
                      ? 0.4
                      : pressed
                        ? 0.85
                        : 1,
                },
              ]}>
              {busy ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <ThemedText type="smallBold" style={{ color: theme.background }}>
                  {resetSent ? t('auth.resetSubmit') : t('auth.resetSend')}
                </ThemedText>
              )}
            </Pressable>
          ) : (
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
          )}

          {mode === 'reset' && resetSent ? (
            <Pressable onPress={sendResetCode} disabled={busy} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.switch}>
                {t('auth.resetResend')}
              </ThemedText>
            </Pressable>
          ) : null}
          {mode === 'login' ? (
            <Pressable
              onPress={() => {
                setMode('reset');
                setResetSent(false);
                setResetCode('');
                setPassword('');
              }}
              hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.switch}>
                {t('auth.forgot')}
              </ThemedText>
            </Pressable>
          ) : null}

          {mode !== 'reset' && GOOGLE_CLIENT_ID && Platform.OS === 'web' ? (
            // Full-page OAuth redirect — survives mobile-Safari popup/cookie
            // blocking (the GIS popup hung at gsi/transform). The id_token comes
            // back in the URL fragment and AuthProvider adopts it on boot.
            <Pressable
              onPress={() => {
                const g = globalThis as unknown as { location: { origin: string; href: string } };
                const q = new URLSearchParams({
                  client_id: GOOGLE_CLIENT_ID,
                  redirect_uri: g.location.origin,
                  response_type: 'id_token',
                  scope: 'openid email profile',
                  nonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
                  prompt: 'select_account',
                });
                g.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
              }}
              style={({ pressed }) => [
                styles.google,
                { borderColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="logo-google" size={18} color={theme.text} />
              <ThemedText type="smallBold">{t('auth.google')}</ThemedText>
            </Pressable>
          ) : mode !== 'reset' && Platform.OS !== 'web' ? (
            // Native Google is SERVER-driven — no client id needed on the app,
            // so the button always shows (the server explains if unconfigured).
            <Pressable
              onPress={nativeGoogle}
              disabled={busy}
              style={({ pressed }) => [
                styles.google,
                { borderColor: theme.backgroundSelected, opacity: busy ? 0.4 : pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="logo-google" size={18} color={theme.text} />
              <ThemedText type="smallBold">{busy ? t('auth.waitingGoogle') : t('auth.google')}</ThemedText>
            </Pressable>
          ) : mode !== 'reset' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.blurb}>
              {t('auth.googleUnconfigured')}
            </ThemedText>
          ) : null}

          {mode !== 'reset' && appleAvailable ? (
            <Pressable
              onPress={appleLogin}
              disabled={busy}
              style={({ pressed }) => [
                styles.google,
                { borderColor: theme.backgroundSelected, opacity: busy ? 0.4 : pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="logo-apple" size={18} color={theme.text} />
              <ThemedText type="smallBold">{t('auth.apple')}</ThemedText>
            </Pressable>
          ) : null}

          {mode !== 'reset' ? (
            <Pressable
              onPress={githubLogin}
              disabled={busy}
              style={({ pressed }) => [
                styles.google,
                { borderColor: theme.backgroundSelected, opacity: busy ? 0.4 : pressed ? 0.7 : 1 },
              ]}>
              <Ionicons name="logo-github" size={18} color={theme.text} />
              <ThemedText type="smallBold">{t('auth.github')}</ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setMode((m) => (m === 'login' ? 'register' : 'login'))}
            hitSlop={8}>
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
    paddingHorizontal: Spacing.screen,
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
  logo: { alignSelf: 'center', width: 72, height: 72, borderRadius: 18 },
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
  gsi: { alignItems: 'center', minHeight: 44 },
  switch: { textAlign: 'center', textDecorationLine: 'underline', paddingVertical: Spacing.two },
});
