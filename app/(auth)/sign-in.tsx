import { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable,
} from 'react-native';
import { Link, router } from 'expo-router';
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
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormData = z.infer<typeof schema>;

export default function SignInScreen() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [authError, setAuthError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email, password }: FormData) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Generic message — never reveal whether email exists (OWASP A07)
      setAuthError('Invalid email or password.');
    }
    // On success, the auth listener in _layout.tsx fires setSession → index.tsx redirects
  };

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
        {/* Logo placeholder */}
        <View style={[styles.logoWrap, { marginBottom: spacing[10] }]}>
          <Text style={{ fontSize: 32, color: colors.text }}>💪</Text>
        </View>

        <Text style={[styles.title, { color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }]}>
          Welcome back
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fontSize.base, marginBottom: spacing[8] }]}>
          Sign in to continue tracking
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
              autoComplete="password"
              error={errors.password?.message}
            />
          )}
        />

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          style={{ alignSelf: 'flex-end', marginTop: spacing[2], marginBottom: spacing[6] }}
          hitSlop={8}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Forgot password?</Text>
        </Pressable>

        {authError && (
          <Text style={[styles.errorText, { color: colors.error, fontSize: fontSize.sm, marginBottom: spacing[4] }]}>
            {authError}
          </Text>
        )}

        <Button
          label="Sign in"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />

        <View style={[styles.footer, { marginTop: spacing[6] }]}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable hitSlop={8}>
              <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                Sign up
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
  container: { flexGrow: 1 },
  logoWrap: { alignItems: 'center' },
  title: { marginBottom: 8 },
  subtitle: {},
  errorText: { textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
