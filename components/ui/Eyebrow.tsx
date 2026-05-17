import { Text, TextStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface EyebrowProps {
  children: React.ReactNode;
  style?: TextStyle;
}

export function Eyebrow({ children, style }: EyebrowProps) {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  return (
    <Text
      style={[
        {
          color: colors.textMuted,
          fontSize: fontSize.xs,
          fontWeight: fontWeight.semibold,
          letterSpacing: 0.88,
          textTransform: 'uppercase',
          marginBottom: spacing[2],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
