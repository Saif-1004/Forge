import { useColorScheme } from 'react-native';
import { dark, light } from '@/theme/colors';
import { spacing, radius, shadow, fontFamily, fontSize, fontWeight } from '@/theme';
import { useSettingsStore } from '@/store/settingsStore';

export function useTheme() {
  const systemScheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const scheme = themeMode === 'system' ? (systemScheme ?? 'dark') : themeMode;
  const colors = scheme === 'dark' ? dark : light;
  return { colors, spacing, radius, shadow, fontFamily, fontSize, fontWeight, scheme };
}
