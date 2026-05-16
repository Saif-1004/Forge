import { router } from 'expo-router';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { OptionCard } from '@/components/onboarding/OptionCard';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { ExperienceLevel } from '@/lib/supabase/types';

const OPTIONS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'beginner', label: 'Beginner', description: 'Less than 6 months of consistent training' },
  { value: 'novice', label: 'Novice', description: '6 months – 2 years' },
  { value: 'intermediate', label: 'Intermediate', description: '2–5 years' },
  { value: 'advanced', label: 'Advanced', description: '5+ years' },
];

export default function ExperienceScreen() {
  const { data, update } = useOnboardingStore();

  return (
    <OnboardingLayout
      step={7} total={13}
      title="Training experience"
      subtitle="This helps your AI coach calibrate program intensity."
      onBack={() => router.back()}
      footer={
        <Button
          label="Continue"
          onPress={() => router.push('/onboarding/goal')}
          disabled={!data.experienceLevel}
        />
      }
    >
      {OPTIONS.map((opt) => (
        <OptionCard
          key={opt.value}
          label={opt.label}
          description={opt.description}
          selected={data.experienceLevel === opt.value}
          onPress={() => update({ experienceLevel: opt.value })}
        />
      ))}
    </OnboardingLayout>
  );
}
