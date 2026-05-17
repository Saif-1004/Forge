import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();

  const bg = {
    default: colors.surface,
    success: colors.success + '20',
    warning: colors.warning + '20',
    danger: colors.danger + '20',
  }[variant];

  const textColor = {
    default: colors.textMuted,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  }[variant];

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing[2],
          paddingVertical: 3,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={{ color: textColor, fontSize: fontSize.xs, fontWeight: fontWeight.medium }}>
        {label}
      </Text>
    </View>
  );
}
