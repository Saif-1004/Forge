import { Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';

export default function HomeTab() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  useAuthStore();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing[4], paddingHorizontal: spacing[5], paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing[1] }}>
        Good morning 👋
      </Text>
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[8] }}>
        Dashboard
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
        Your home feed will appear here — recent workouts, nutrition summary, PRs, and AI Coach highlights.
      </Text>
    </ScrollView>
  );
}
