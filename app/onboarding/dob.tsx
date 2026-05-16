import { useState } from 'react';
import { View, Text, Platform } from 'react-native';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTheme } from '@/hooks/useTheme';

const MIN_AGE = 13;
const MAX_AGE = 100;

function clampDate(d: Date): Date {
  const now = new Date();
  const minDate = new Date(now.getFullYear() - MAX_AGE, now.getMonth(), now.getDate());
  const maxDate = new Date(now.getFullYear() - MIN_AGE, now.getMonth(), now.getDate());
  if (d < minDate) return minDate;
  if (d > maxDate) return maxDate;
  return d;
}

export default function DobScreen() {
  const { colors, fontSize, spacing } = useTheme();
  const { data, update } = useOnboardingStore();

  const defaultDate = clampDate(new Date(2000, 0, 1));
  const [date, setDate] = useState<Date>(
    data.dateOfBirth ? new Date(data.dateOfBirth) : defaultDate,
  );

  const onNext = () => {
    update({ dateOfBirth: date.toISOString().split('T')[0] });
    router.push('/onboarding/height');
  };

  return (
    <OnboardingLayout
      step={4} total={13}
      title="Date of birth"
      subtitle="Your age helps us calculate accurate calorie targets."
      onBack={() => router.back()}
      onSkip={() => router.push('/onboarding/height')}
      footer={<Button label="Continue" onPress={onNext} />}
    >
      <View style={{ alignItems: 'center', marginTop: spacing[4] }}>
        <DateTimePicker
          value={date}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={clampDate(new Date())}
          minimumDate={new Date(new Date().getFullYear() - MAX_AGE, 0, 1)}
          onChange={(_e, d) => d && setDate(clampDate(d))}
          textColor={colors.text}
          accentColor={colors.accent}
          themeVariant={colors.background === '#111111' ? 'dark' : 'light'}
          style={{ width: '100%' }}
        />
      </View>
    </OnboardingLayout>
  );
}
