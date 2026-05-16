import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';

export default function WelcomeScreen() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: spacing[6] }}>💪</Text>
        <Text style={[styles.title, { color: colors.text, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }]}>
          Your gym.{'\n'}Your nutrition.{'\n'}One place.
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fontSize.base }]}>
          Track workouts, log food, and let your AI coach optimise both — tailored to you.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24, paddingHorizontal: spacing[5] }]}>
        <Button label="Get started" onPress={() => router.push('/onboarding/name')} />
        <Button
          label="I already have an account"
          variant="ghost"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  title: { marginBottom: 16, lineHeight: 44 },
  subtitle: { lineHeight: 24 },
  footer: { gap: 12 },
});
