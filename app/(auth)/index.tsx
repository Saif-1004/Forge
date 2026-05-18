import { useState } from 'react';
import { View, Text, Image, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/Button';

WebBrowser.maybeCompleteAuthSession();

function GoogleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48" style={{ marginRight: 10 }}>
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <Path fill="none" d="M0 0h48v48H0z"/>
    </Svg>
  );
}

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
        await supabase.auth.exchangeCodeForSession(result.url);
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
              backgroundColor: '#000',
              opacity: googleLoading ? 0.6 : 1,
            },
          ]}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
          ) : (
            <GoogleIcon />
          )}
          <Text style={{ color: '#fff', fontSize: fontSize.base, fontWeight: fontWeight.medium }}>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  legal: { textAlign: 'center', lineHeight: 18 },
});
