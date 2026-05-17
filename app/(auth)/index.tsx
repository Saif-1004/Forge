import { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';

WebBrowser.maybeCompleteAuthSession();

export default function AuthLandingScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApple = async () => {
    setError(null);
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      // Auth state listener in _layout.tsx handles redirect
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        setError('Apple sign in failed. Please try again.');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const redirectTo = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const accessToken = parsed.queryParams?.access_token as string | undefined;
        const refreshToken = parsed.queryParams?.refresh_token as string | undefined;
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      }
    } catch {
      setError('Google sign in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        <Image
          source={require('@/assets/non_pixelated_transparent.png')}
          style={{ width: 160, height: 160, marginBottom: spacing[6], alignSelf: 'center', tintColor: colors.text }}
          resizeMode="contain"
        />
        <Text style={[styles.title, { color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }]}>
          Your gym.{'\n'}Your nutrition.
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fontSize.base }]}>
          Track smarter. Train harder. Eat better.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 32, paddingHorizontal: spacing[5] }]}>
        {error && (
          <Text style={{ color: colors.error, fontSize: fontSize.sm, textAlign: 'center', marginBottom: spacing[3] }}>
            {error}
          </Text>
        )}

        {/* Apple Sign In — iOS only */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={8}
            style={{ width: '100%', height: 50 }}
            onPress={handleApple}
          />
        )}

        <View style={{ height: spacing[3] }} />

        {/* Google */}
        <Pressable
          onPress={handleGoogle}
          disabled={googleLoading}
          style={[
            styles.googleBtn,
            {
              borderRadius: radius.lg,
              borderColor: colors.border,
              backgroundColor: colors.background,
              opacity: googleLoading ? 0.5 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 18, marginRight: 8 }}>G</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium }}>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </Pressable>

        <View style={{ height: spacing[3] }} />

        {/* Email */}
        <Button
          label="Continue with Email"
          variant="secondary"
          onPress={() => router.push('/(auth)/email')}
        />

        <Text style={[styles.legal, { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing[5] }]}>
          By continuing you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32 },
  title: { marginBottom: 12, lineHeight: 40, textAlign: 'center' },
  subtitle: { lineHeight: 24, textAlign: 'center' },
  footer: { gap: 0 },
  googleBtn: {
    height: 50,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  legal: { textAlign: 'center', lineHeight: 18 },
});
