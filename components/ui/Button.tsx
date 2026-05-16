import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label, onPress, variant = 'primary', loading, disabled, style, fullWidth = false,
}: ButtonProps) {
  const { colors, radius, fontWeight, fontSize } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => { scale.value = withSpring(0.97, { damping: 20, stiffness: 300 }); };
  const handlePressOut = () => { scale.value = withSpring(1, { damping: 20, stiffness: 300 }); };

  const bg = {
    primary: colors.accent,
    secondary: colors.surface,
    ghost: 'transparent',
    danger: colors.danger,
  }[variant];

  const textColor = {
    primary: colors.accentForeground,
    secondary: colors.text,
    ghost: colors.textMuted,
    danger: '#FFFFFF',
  }[variant];

  const borderColor = variant === 'secondary' ? colors.border : 'transparent';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.base,
        { backgroundColor: bg, borderColor, borderRadius: radius.lg, borderWidth: variant === 'secondary' ? 1 : 0 },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        animStyle,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={[styles.label, { color: textColor, fontWeight: fontWeight.semibold, fontSize: fontSize.base }]}>{label}</Text>
      }
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.4 },
  label: { textAlign: 'center' },
});
