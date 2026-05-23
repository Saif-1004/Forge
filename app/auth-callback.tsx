import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/hooks/useTheme';

// Signals to WebBrowser.openAuthSessionAsync that the OAuth redirect was received,
// closing the in-app browser on Android. Navigation is handled by the auth state
// listener in _layout.tsx once the session is established.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}
