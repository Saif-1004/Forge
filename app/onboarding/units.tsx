import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { UnitSystem } from '@/lib/supabase/types';

const OPTIONS: { value: UnitSystem; label: string; description: string }[] = [
  { value: 'imperial', label: 'Imperial', description: 'lbs, ft / in, °F' },
  { value: 'metric', label: 'Metric', description: 'kg, cm, °C' },
];

export default function UnitsScreen() {
  const { data, update } = useOnboardingStore();
  const selected = data.unitSystem ?? 'imperial';

  return (
    <OnboardingLayout
      step={2} total={13}
      title="Units"
      subtitle="Which system do you prefer? You can change this anytime in settings."
      onBack={() => router.back()}
      footer={<Button label="Continue" onPress={() => router.push('/onboarding/gender')} />}
    >
      {OPTIONS.map((opt) => (
        <OptionCard
          key={opt.value}
          label={opt.label}
          description={opt.description}
          selected={selected === opt.value}
          onPress={() => update({ unitSystem: opt.value })}
        />
      ))}
    </OnboardingLayout>
  );
}
