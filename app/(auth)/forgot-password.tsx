import { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordScreen() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [sent, setSent] = useState(false);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email }: FormData) => {
    // Always show success — never reveal if an email is registered (OWASP A07)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'pumps://reset-password',
    });
    setSent(true);
  };

  if (sent) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: spacing[5] }]}>
        <Text style={{ fontSize: 40, marginBottom: spacing[6] }}>✉️</Text>
        <Text style={[{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' }]}>
          Check your email
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center', marginTop: spacing[3], lineHeight: 24 }}>
          If an account exists for that email, we've sent a reset link.
        </Text>
        <View style={{ marginTop: spacing[8], width: '100%' }}>
          <Button label="Back to sign in" variant="secondary" onPress={() => router.replace('/(auth)/sign-in')} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24, paddingHorizontal: spacing[5] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ marginBottom: spacing[8] }}
          hitSlop={12}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>← Back</Text>
        </Pressable>

        <Text style={[{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[2] }]}>
          Reset password
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base, marginBottom: spacing[8], lineHeight: 22 }}>
          Enter your email and we'll send you a reset link.
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              error={errors.email?.message}
            />
          )}
        />

        <View style={{ marginTop: spacing[8] }}>
          <Button
            label="Send reset link"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1 },
});
