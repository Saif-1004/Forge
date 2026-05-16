import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { computeNutritionTargets } from '@/lib/nutrition/tdee';

export default function AllSetScreen() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, reset } = useOnboardingStore();
  const { user, setOnboardingCompleted } = useAuthStore();
  const lottieRef = useRef<LottieView>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lottieRef.current?.play();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const onStart = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);

    try {
      const targets = computeNutritionTargets(data);

      const { error: upsertError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email ?? '',
          display_name: data.displayName ?? null,
          unit_system: data.unitSystem ?? 'imperial',
          unit_preference: data.unitSystem === 'metric' ? 'kg' : 'lbs',
          gender: data.gender ?? null,
          date_of_birth: data.dateOfBirth ?? null,
          height_cm: data.heightCm ?? null,
          weight_kg: data.weightKg ?? null,
          experience_level: data.experienceLevel ?? null,
          primary_goal: data.primaryGoal ?? null,
          training_days_per_week: data.trainingDaysPerWeek ?? null,
          equipment_access: data.equipmentAccess ?? [],
          goal_weight_kg: data.goalWeightKg ?? null,
          weight_change_rate_kg_per_week: data.weightChangeRateKgPerWeek ?? null,
          calorie_target_kcal: targets?.calories ?? null,
          protein_target_g: targets?.protein ?? null,
          carbs_target_g: targets?.carbs ?? null,
          fat_target_g: targets?.fat ?? null,
          nutrition_tracking_enabled: data.nutritionTrackingEnabled ?? true,
          onboarding_completed_at: new Date().toISOString(),
        });

      if (upsertError) { console.error('Supabase upsert error:', JSON.stringify(upsertError)); throw upsertError; }

      reset();
      setOnboardingCompleted(true);
      router.replace('/(tabs)');
    } catch (e: any) {
      console.error('Onboarding save error:', JSON.stringify(e));
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <LottieView
          ref={lottieRef}
          source={require('@/assets/animations/confetti.json')}
          style={styles.lottie}
          loop={false}
          autoPlay
        />

        <Text style={[styles.title, { color: colors.text, fontSize: fontSize['3xl'], fontWeight: fontWeight.bold }]}>
          You're all set{data.displayName ? `, ${data.displayName}` : ''}!
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fontSize.base }]}>
          Your profile is ready. Time to start crushing your goals.
        </Text>

        {error && (
          <Text style={{ color: colors.error, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing[4] }}>
            {error}
          </Text>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24, paddingHorizontal: spacing[5] }]}>
        <Button label="Start training" onPress={onStart} loading={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  lottie: { width: 200, height: 200 },
  title: { textAlign: 'center', marginTop: 16, marginBottom: 12 },
  subtitle: { textAlign: 'center', lineHeight: 24 },
  footer: {},
});
