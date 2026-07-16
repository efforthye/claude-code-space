/**
 * Minimal app-wide toast. useToast().show(message) pops a short-lived banner
 * near the bottom of the screen — used to confirm mock actions (publish,
 * extend retention, plan change) that otherwise just dismiss silently.
 */

import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ToastValue = { show: (message: string) => void };

const ToastContext = createContext<ToastValue | null>(null);
const VISIBLE_MS = 2400;

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
          ({ finished }) => {
            if (finished) setMessage(null);
          },
        );
      }, VISIBLE_MS);
    },
    [opacity],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const value = useMemo<ToastValue>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <SafeAreaView edges={['bottom']} pointerEvents="none" style={styles.host}>
          <Animated.View
            style={[styles.toast, { backgroundColor: theme.text, opacity }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.background} />
            <ThemedText type="small" style={{ color: theme.background }} numberOfLines={2}>
              {message}
            </ThemedText>
          </Animated.View>
        </SafeAreaView>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six + Spacing.four,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: 420,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
  },
});
