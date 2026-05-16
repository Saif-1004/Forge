import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

export default function WorkoutTab() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing[4], paddingHorizontal: spacing[5] }}>
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>Workout</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.base, marginTop: spacing[3] }}>
        Start a workout, browse exercises, and view session history.
      </Text>
    </View>
  );
}
