/**
 * Theme colors for the active scheme. The scheme comes from the app's Settings
 * (System / Light / Dark), which falls back to the OS color scheme.
 */

import { Colors } from '@/constants/theme';
import { useSettings } from '@/settings/settings';

export function useTheme() {
  const { scheme } = useSettings();
  return Colors[scheme];
}
