import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({ email: z.string().email('Enter a valid email') });

export default function EmailScreen() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email }: { email: string }) => {
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) { setError(error.message); return; }
    router.push({ pathname: '/(auth)/verify', params: { email } });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingHorizontal: spacing[5] }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing[8] }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>

        <Text style={[{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[2] }]}>
          What&apos;s your email?
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base, marginBottom: spacing[8], lineHeight: 22 }}>
          We&apos;ll send a 6-digit code to verify it&apos;s you. No password needed.
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
              error={errors.email?.message}
            />
          )}
        />

        {error && (
          <Text style={{ color: colors.error, fontSize: fontSize.sm, marginTop: spacing[3] }}>
            {error}
          </Text>
        )}

        <View style={{ marginTop: spacing[8] }}>
          <Button label="Send code" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
});
