import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';

export default function ProfileTab() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing[4], paddingHorizontal: spacing[5] }}>
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[2] }}>
        Profile
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing[8] }}>
        {user?.email}
      </Text>
      <Button label="Sign out" variant="danger" onPress={signOut} />
    </View>
  );
}
