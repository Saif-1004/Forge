import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTheme } from '@/hooks/useTheme';

function lbsToKg(lbs: number): number { return Math.round(lbs * 0.453592 * 10) / 10; }
function kgToLbs(kg: number): number { return Math.round(kg / 0.453592 * 10) / 10; }

export default function GoalWeightScreen() {
  const { spacing } = useTheme();
  const { data, update } = useOnboardingStore();
  const isImperial = data.unitSystem === 'imperial';

  const initialKg = data.goalWeightKg ?? data.weightKg ?? 75;
  const [value, setValue] = useState(
    String(isImperial ? kgToLbs(initialKg) : initialKg),
  );
  const [error, setError] = useState<string | null>(null);

  const onNext = () => {
    setError(null);
    const num = parseFloat(value);
    if (isNaN(num)) { setError('Enter a valid weight'); return; }
    const kg = isImperial ? lbsToKg(num) : num;
    if (kg < 30 || kg > 300) { setError('Enter a weight between 30–300 kg'); return; }
    update({ goalWeightKg: kg });
    router.push('/onboarding/weight-rate');
  };

  return (
    <OnboardingLayout
      step={9} total={13}
      title="Goal weight"
      subtitle="What weight are you aiming for? This can be changed anytime."
      onBack={() => router.back()}
      onSkip={() => router.push('/onboarding/weight-rate')}
      footer={<Button label="Continue" onPress={onNext} />}
    >
      <View style={{ marginTop: spacing[2] }}>
        <Input
          label={isImperial ? 'Goal weight (lbs)' : 'Goal weight (kg)'}
          value={value}
          onChangeText={setValue}
          keyboardType="decimal-pad"
          error={error ?? undefined}
          autoFocus
        />
      </View>
    </OnboardingLayout>
  );
}
