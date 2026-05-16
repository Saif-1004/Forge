import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function NutritionScreen() {
  const { data, update } = useOnboardingStore();

  return (
    <OnboardingLayout
      step={13} total={13}
      title="Nutrition tracking"
      subtitle="Would you like to track your calories and macros? You can always enable this later."
      onBack={() => router.back()}
      footer={<Button label="Continue" onPress={() => router.push('/onboarding/all-set')} />}
    >
      <OptionCard
        label="Yes, track my nutrition"
        description="Log meals, hit macro targets, and sync with your workout data for a complete picture."
        emoji="🥗"
        selected={data.nutritionTrackingEnabled === true}
        onPress={() => update({ nutritionTrackingEnabled: true })}
      />
      <OptionCard
        label="No, just workouts for now"
        description="You can enable nutrition tracking at any time from your profile settings."
        emoji="🏋️"
        selected={data.nutritionTrackingEnabled === false}
        onPress={() => update({ nutritionTrackingEnabled: false })}
      />
    </OnboardingLayout>
  );
}
