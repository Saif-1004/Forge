import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/hooks/useTheme';

export default function AuthCallbackScreen() {
  const { colors } = useTheme();

  useEffect(() => {
    // Signals to WebBrowser.openAuthSessionAsync that the OAuth redirect was
    // received, closing the in-app browser on Android. Must run in useEffect
    // (not at module level) to avoid firing at app startup.
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}
