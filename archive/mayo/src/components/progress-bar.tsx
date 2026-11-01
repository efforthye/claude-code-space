import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function ProgressBar({ value }: { value: number }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.text }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
});
