import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';

export default function Index() {
  const { session, isLoading, onboardingCompleted } = useAuthStore();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/" />;
  if (!onboardingCompleted) return <Redirect href="/onboarding/name" />;
  return <Redirect href="/(tabs)" />;
}
