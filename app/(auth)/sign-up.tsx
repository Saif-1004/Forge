import { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable,
} from 'react-native';
import { Link } from 'expo-router';
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
  password: z
    .string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});
type FormData = z.infer<typeof schema>;

type State = 'idle' | 'submitting' | 'verify';

export default function SignUpScreen() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>('idle');
  const [authError, setAuthError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, password }: FormData) => {
    setAuthError(null);
    setState('submitting');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
      setState('idle');
    } else {
      setState('verify');
    }
  };

  if (state === 'verify') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingHorizontal: spacing[5] }]}>
        <Text style={{ fontSize: 40, marginBottom: spacing[6] }}>📬</Text>
        <Text style={[styles.title, { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' }]}>
          Check your inbox
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center', marginTop: spacing[3], lineHeight: 24 }}>
          We sent a confirmation link to your email. Click it to activate your account, then sign in.
        </Text>
        <View style={{ marginTop: spacing[8], width: '100%' }}>
          <Link href="/(auth)/sign-in" asChild>
            <Button label="Back to sign in" variant="secondary" onPress={() => {}} />
          </Link>
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
        <Text style={[styles.title, { color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }]}>
          Create account
        </Text>
        <Text style={[{ color: colors.textMuted, fontSize: fontSize.base, marginBottom: spacing[8] }]}>
          Start tracking your progress
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

        <View style={{ height: spacing[4] }} />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry
              autoComplete="new-password"
              error={errors.password?.message}
            />
          )}
        />

        <View style={{ height: spacing[4] }} />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Confirm password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              secureTextEntry
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
            />
          )}
        />

        {authError && (
          <Text style={[styles.errorText, { color: colors.error, fontSize: fontSize.sm, marginTop: spacing[4] }]}>
            {authError}
          </Text>
        )}

        <View style={{ marginTop: spacing[8] }}>
          <Button
            label="Create account"
            onPress={handleSubmit(onSubmit)}
            loading={state === 'submitting'}
          />
        </View>

        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginTop: spacing[4], lineHeight: 18 }}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </Text>

        <View style={[styles.footer, { marginTop: spacing[6] }]}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable hitSlop={8}>
              <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                Sign in
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1 },
  title: { marginBottom: 8 },
  errorText: { textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
