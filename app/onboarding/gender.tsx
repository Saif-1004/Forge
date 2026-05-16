import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { Gender } from '@/lib/supabase/types';

const OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male', label: 'Male', emoji: '♂️' },
  { value: 'female', label: 'Female', emoji: '♀️' },
  { value: 'unspecified', label: 'Prefer not to say', emoji: '·' },
];

export default function GenderScreen() {
  const { data, update } = useOnboardingStore();

  return (
    <OnboardingLayout
      step={3} total={13}
      title="Biological sex"
      subtitle="Used to calculate your calorie and nutrition targets more accurately."
      onBack={() => router.back()}
      onSkip={() => { update({ gender: 'unspecified' }); router.push('/onboarding/dob'); }}
      footer={
        <Button
          label="Continue"
          onPress={() => router.push('/onboarding/dob')}
          disabled={!data.gender}
        />
      }
    >
      {OPTIONS.map((opt) => (
        <OptionCard
          key={opt.value}
          label={opt.label}
          emoji={opt.emoji}
          selected={data.gender === opt.value}
          onPress={() => update({ gender: opt.value })}
        />
      ))}
    </OnboardingLayout>
  );
}
