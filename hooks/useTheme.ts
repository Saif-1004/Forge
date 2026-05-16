import { useColorScheme } from 'react-native';
import { dark, light } from '@/theme/colors';
import { spacing, radius, shadow, fontFamily, fontSize, fontWeight } from '@/theme';

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  return { colors, spacing, radius, shadow, fontFamily, fontSize, fontWeight, scheme };
}
