import { LayoutChangeEvent, Pressable, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type ChipVariant = 'filled' | 'outline';

interface ChipProps {
  label: string;
  active?: boolean;
  variant?: ChipVariant;
  onPress?: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  style?: ViewStyle;
}

export function Chip({ label, active = false, variant = 'filled', onPress, onLayout, style }: ChipProps) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();

  const containerStyle: ViewStyle =
    variant === 'outline'
      ? {
          backgroundColor: active ? colors.text : 'transparent',
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: active ? colors.text : colors.border,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
        }
      : {
          backgroundColor: active ? colors.text : colors.surface,
          borderRadius: radius.full,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[1],
        };

  const labelColor =
    variant === 'outline'
      ? active ? colors.background : colors.text
      : active ? colors.background : colors.textMuted;

  return (
    <Pressable onPress={onPress} onLayout={onLayout} style={[containerStyle, style]}>
      <Text
        style={{
          color: labelColor,
          fontSize: fontSize.xs,
          fontWeight: active ? fontWeight.semibold : fontWeight.normal,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
