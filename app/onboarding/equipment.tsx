import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';

const OPTIONS = [
  { value: 'full_gym', label: 'Full gym', description: 'Barbells, dumbbells, cables, machines', emoji: '🏋️' },
  { value: 'dumbbells', label: 'Dumbbells only', description: 'Home setup with dumbbells', emoji: '💪' },
  { value: 'barbell', label: 'Barbell + rack', description: 'Squat rack, bench, barbell', emoji: '🏗️' },
  { value: 'bodyweight', label: 'Bodyweight', description: 'No equipment — calisthenics', emoji: '🤸' },
  { value: 'resistance_bands', label: 'Resistance bands', description: 'Bands and bodyweight', emoji: '🔄' },
  { value: 'kettlebells', label: 'Kettlebells', description: 'Kettlebell focused', emoji: '🔔' },
];

export default function EquipmentScreen() {
  const { data, update } = useOnboardingStore();
  const selected = data.equipmentAccess ?? [];

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    update({ equipmentAccess: next });
  };

  return (
    <OnboardingLayout
      step={12} total={13}
      title="Equipment access"
      subtitle="Select all that apply. Your AI coach will only program exercises you have equipment for."
      onBack={() => router.back()}
      footer={
        <Button
          label="Continue"
          onPress={() => router.push('/onboarding/nutrition')}
          disabled={selected.length === 0}
        />
      }
    >
      {OPTIONS.map((opt) => (
        <OptionCard
          key={opt.value}
          label={opt.label}
          description={opt.description}
          emoji={opt.emoji}
          selected={selected.includes(opt.value)}
          onPress={() => toggle(opt.value)}
          multiSelect
        />
      ))}
    </OnboardingLayout>
  );
}
