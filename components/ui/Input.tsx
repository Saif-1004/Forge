import React, { useState } from 'react';
import { TextInput, View, Text, TextInputProps, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, onFocus, onBlur, ...props }: InputProps) {
  const { colors, radius, fontSize, fontWeight } = useTheme();
  const [focused, setFocused] = useState(false);

  const labelTop = useSharedValue(props.value ? 6 : 16);
  const labelSize = useSharedValue(props.value ? fontSize.xs : fontSize.base);

  const labelStyle = useAnimatedStyle(() => ({
    top: withTiming(labelTop.value, { duration: 150 }),
    fontSize: withTiming(labelSize.value, { duration: 150 }),
  }));

  const handleFocus = (e: any) => {
    setFocused(true);
    labelTop.value = 6;
    labelSize.value = fontSize.xs;
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setFocused(false);
    if (!props.value) {
      labelTop.value = 16;
      labelSize.value = fontSize.base;
    }
    onBlur?.(e);
  };

  const borderColor = error ? colors.danger : focused ? colors.text : colors.border;

  return (
    <View style={containerStyle}>
      <View style={[
        styles.container,
        { borderColor, borderRadius: radius.lg, backgroundColor: colors.surface },
      ]}>
        <Animated.Text style={[labelStyle, { color: colors.textMuted, position: 'absolute', left: 14 }]}>
          {label}
        </Animated.Text>
        <TextInput
          {...props}
          style={[styles.input, { color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.normal }]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.textMuted}
        />
      </View>
      {error && <Text style={[styles.error, { color: colors.danger, fontSize: fontSize.xs }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, height: 58, justifyContent: 'flex-end' },
  input: { paddingHorizontal: 14, paddingBottom: 10, paddingTop: 20 },
  error: { marginTop: 4, marginLeft: 4 },
});
