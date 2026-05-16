import { View } from 'react-native';
import { router } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTheme } from '@/hooks/useTheme';

const schema = z.object({
  displayName: z.string().min(1, 'Enter your name').max(50, 'Name too long'),
});

export default function NameScreen() {
  const { spacing } = useTheme();
  const { data, update } = useOnboardingStore();

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { displayName: data.displayName ?? '' },
  });

  const onNext = ({ displayName }: { displayName: string }) => {
    update({ displayName: displayName.trim() });
    router.push('/onboarding/units');
  };

  return (
    <OnboardingLayout
      step={1} total={13}
      title="What's your name?"
      subtitle="We'll use this to personalise your experience."
      footer={<Button label="Continue" onPress={handleSubmit(onNext)} />}
    >
      <View style={{ marginTop: spacing[2] }}>
        <Controller
          control={control}
          name="displayName"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="First name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="words"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onNext)}
              error={errors.displayName?.message}
            />
          )}
        />
      </View>
    </OnboardingLayout>
  );
}
