import { useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTheme } from '@/hooks/useTheme';

function feetInchesToCm(ft: number, inch: number): number {
  return Math.round((ft * 30.48) + (inch * 2.54));
}

function cmToFeetInches(cm: number): [number, number] {
  const totalInches = cm / 2.54;
  return [Math.floor(totalInches / 12), Math.round(totalInches % 12)];
}

export default function HeightScreen() {
  const { colors, fontSize, spacing } = useTheme();
  const { data, update } = useOnboardingStore();
  const isImperial = data.unitSystem === 'imperial';

  const initial = data.heightCm ?? (isImperial ? feetInchesToCm(5, 8) : 170);
  const [feet, setFeet] = useState(String(cmToFeetInches(initial)[0]));
  const [inches, setInches] = useState(String(cmToFeetInches(initial)[1]));
  const [cm, setCm] = useState(String(initial));
  const [error, setError] = useState<string | null>(null);

  const onNext = () => {
    setError(null);
    let heightCm: number;
    if (isImperial) {
      const ft = parseInt(feet, 10);
      const inch = parseInt(inches, 10);
      if (isNaN(ft) || isNaN(inch) || ft < 3 || ft > 8 || inch < 0 || inch > 11) {
        setError('Enter a valid height (3–8 ft)');
        return;
      }
      heightCm = feetInchesToCm(ft, inch);
    } else {
      heightCm = parseInt(cm, 10);
      if (isNaN(heightCm) || heightCm < 100 || heightCm > 250) {
        setError('Enter a valid height (100–250 cm)');
        return;
      }
    }
    update({ heightCm });
    router.push('/onboarding/weight');
  };

  return (
    <OnboardingLayout
      step={5} total={13}
      title="Your height"
      subtitle="Used to calculate your BMR and calorie targets."
      onBack={() => router.back()}
      onSkip={() => router.push('/onboarding/weight')}
      footer={<Button label="Continue" onPress={onNext} />}
    >
      <View style={{ marginTop: spacing[2], gap: spacing[4] }}>
        {isImperial ? (
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Feet"
                value={feet}
                onChangeText={setFeet}
                keyboardType="number-pad"
                error={error ?? undefined}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Inches"
                value={inches}
                onChangeText={setInches}
                keyboardType="number-pad"
              />
            </View>
          </View>
        ) : (
          <Input
            label="Height (cm)"
            value={cm}
            onChangeText={setCm}
            keyboardType="number-pad"
            error={error ?? undefined}
          />
        )}
      </View>
    </OnboardingLayout>
  );
}
