import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';

const OPTIONS = [
  { days: 2, label: '2 days / week', description: 'Light schedule — great for beginners' },
  { days: 3, label: '3 days / week', description: 'Standard — most people start here' },
  { days: 4, label: '4 days / week', description: 'Popular split — upper/lower or push/pull' },
  { days: 5, label: '5 days / week', description: 'High frequency — for the dedicated' },
  { days: 6, label: '6 days / week', description: 'Very high — advanced lifters' },
];

export default function TrainingDaysScreen() {
  const { data, update } = useOnboardingStore();

  return (
    <OnboardingLayout
      step={11} total={13}
      title="Training days"
      subtitle="How many days per week are you planning to train?"
      onBack={() => router.back()}
      footer={
        <Button
          label="Continue"
          onPress={() => router.push('/onboarding/equipment')}
          disabled={!data.trainingDaysPerWeek}
        />
      }
    >
      {OPTIONS.map((opt) => (
        <OptionCard
          key={opt.days}
          label={opt.label}
          description={opt.description}
          selected={data.trainingDaysPerWeek === opt.days}
          onPress={() => update({ trainingDaysPerWeek: opt.days })}
        />
      ))}
    </OnboardingLayout>
  );
}
