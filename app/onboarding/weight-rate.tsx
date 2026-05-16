import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';

type RateOption = { rateKg: number; label: string; description: string };

const LOSE_OPTIONS: RateOption[] = [
  { rateKg: -0.25, label: '0.25 kg / week', description: 'Gentle — easiest to maintain, minimal muscle loss' },
  { rateKg: -0.5, label: '0.5 kg / week', description: 'Moderate — recommended for most people' },
  { rateKg: -0.75, label: '0.75 kg / week', description: 'Faster — requires more discipline' },
  { rateKg: -1.0, label: '1 kg / week', description: 'Aggressive — only if you have significant excess fat' },
];

const GAIN_OPTIONS: RateOption[] = [
  { rateKg: 0.125, label: '0.125 kg / week', description: 'Lean bulk — minimal fat gain' },
  { rateKg: 0.25, label: '0.25 kg / week', description: 'Moderate bulk — good balance' },
  { rateKg: 0.5, label: '0.5 kg / week', description: 'Aggressive bulk — faster gains, more fat' },
];

export default function WeightRateScreen() {
  const { data, update } = useOnboardingStore();
  const isLosing = (data.goalWeightKg ?? 75) < (data.weightKg ?? 75);
  const options = data.primaryGoal === 'muscle' ? GAIN_OPTIONS : isLosing ? LOSE_OPTIONS : LOSE_OPTIONS;

  return (
    <OnboardingLayout
      step={10} total={13}
      title="Rate of change"
      subtitle="How fast do you want to reach your goal?"
      onBack={() => router.back()}
      onSkip={() => router.push('/onboarding/training-days')}
      footer={
        <Button
          label="Continue"
          onPress={() => router.push('/onboarding/training-days')}
          disabled={data.weightChangeRateKgPerWeek === undefined || data.weightChangeRateKgPerWeek === null}
        />
      }
    >
      {options.map((opt) => (
        <OptionCard
          key={opt.rateKg}
          label={opt.label}
          description={opt.description}
          selected={data.weightChangeRateKgPerWeek === opt.rateKg}
          onPress={() => update({ weightChangeRateKgPerWeek: opt.rateKg })}
        />
      ))}
    </OnboardingLayout>
  );
}
