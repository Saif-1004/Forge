import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

// Required: signals to WebBrowser.openAuthSessionAsync that the OAuth redirect
// has been received, closing the in-app browser on Android.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const { colors } = useTheme();

  useEffect(() => {
    // The auth state listener in _layout.tsx handles the actual session.
    // This screen just needs to exist so Expo Router doesn't 404 the deep link.
    // Redirect away immediately in case the listener hasn't fired yet.
    const timer = setTimeout(() => router.replace('/'), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}
