import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';

const RESEND_COOLDOWN = 30;

export default function VerifyScreen() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);

  // Countdown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async (value: string) => {
    if (value.length < 6) return;
    setError(null);
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: value,
      type: 'email',
    });
    if (error) {
      setError('Invalid code. Please check and try again.');
      setCode('');
      setVerifying(false);
    }
    // On success: onAuthStateChange in _layout.tsx fires SIGNED_IN,
    // awaits setSession (profile query), then navigates to onboarding or tabs
  };

  const handleChange = (value: string) => {
    setCode(value);
    setError(null);
    if (value.length === 6) verify(value);
  };

  const resend = async () => {
    setResending(true);
    setError(null);
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setCooldown(RESEND_COOLDOWN);
    setResending(false);
    setCode('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.inner, { paddingTop: insets.top + 16, paddingHorizontal: spacing[5] }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginBottom: spacing[8] }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>

        <Text style={[{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[2] }]}>
          Check your email
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base, marginBottom: spacing[10], lineHeight: 22 }}>
          We sent a 6-digit code to{'\n'}
          <Text style={{ color: colors.text, fontWeight: fontWeight.medium }}>{email}</Text>
        </Text>

        <OtpInput value={code} onChange={handleChange} length={6} />

        {error && (
          <Text style={{ color: colors.error, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing[4] }}>
            {error}
          </Text>
        )}

        {verifying && (
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing[4] }}>
            Verifying...
          </Text>
        )}

        <View style={{ marginTop: spacing[8] }}>
          <Button
            label="Verify"
            onPress={() => verify(code)}
            loading={verifying}
            disabled={code.length < 6}
          />
        </View>

        {/* Resend */}
        <View style={[styles.resend, { marginTop: spacing[6] }]}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Didn&apos;t get it? </Text>
          {cooldown > 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              Resend in {cooldown}s
            </Text>
          ) : (
            <Pressable onPress={resend} disabled={resending} hitSlop={8}>
              <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                {resending ? 'Sending...' : 'Resend code'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  resend: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
