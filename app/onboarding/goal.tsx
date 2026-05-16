import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { PrimaryGoal } from '@/lib/supabase/types';

const OPTIONS: { value: PrimaryGoal; label: string; description: string; emoji: string }[] = [
  { value: 'muscle', label: 'Build muscle', description: 'Gain strength and size', emoji: '💪' },
  { value: 'fat_loss', label: 'Lose fat', description: 'Reduce body fat while preserving muscle', emoji: '🔥' },
  { value: 'endurance', label: 'Improve endurance', description: 'Cardio performance and stamina', emoji: '🏃' },
  { value: 'athletic', label: 'Athletic performance', description: 'Power, speed, and sport-specific fitness', emoji: '⚡' },
  { value: 'consistency', label: 'Build consistency', description: 'Form a sustainable training habit', emoji: '📅' },
];

export default function GoalScreen() {
  const { data, update } = useOnboardingStore();

  return (
    <OnboardingLayout
      step={8} total={13}
      title="Primary goal"
      subtitle="We'll tailor your program and nutrition targets to this."
      onBack={() => router.back()}
      footer={
        <Button
          label="Continue"
          onPress={() => router.push('/onboarding/goal-weight')}
          disabled={!data.primaryGoal}
        />
      }
    >
      {OPTIONS.map((opt) => (
        <OptionCard
          key={opt.value}
          label={opt.label}
          description={opt.description}
          emoji={opt.emoji}
          selected={data.primaryGoal === opt.value}
          onPress={() => update({ primaryGoal: opt.value })}
        />
      ))}
    </OnboardingLayout>
  );
}
