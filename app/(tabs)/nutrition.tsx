import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

export default function NutritionTab() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing[4], paddingHorizontal: spacing[5] }}>
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>Nutrition</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.base, marginTop: spacing[3] }}>
        Log meals, track macros, and view your daily nutrition summary.
      </Text>
    </View>
  );
}
