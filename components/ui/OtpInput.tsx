import { useRef, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}

// One box — isolated component so each has its own animated value
function OtpBox({
  digit,
  isActive,
  isFilled,
  shake,
  boxSize,
}: {
  digit: string;
  isActive: boolean;
  isFilled: boolean;
  shake: boolean;
  boxSize: number;
}) {
  const { colors, radius, fontSize, fontWeight } = useTheme();
  const translateX = useSharedValue(0);

  if (shake) {
    translateX.value = withSequence(
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: boxSize,
          height: boxSize + 10,
          borderRadius: radius.lg,
          borderWidth: isActive ? 2 : 1,
          borderColor: isActive ? colors.text : isFilled ? colors.text : colors.border,
          backgroundColor: isFilled ? colors.surface : colors.background,
        },
        animStyle,
      ]}
    >
      <Animated.Text
        style={{
          color: colors.text,
          fontSize: fontSize.xl,
          fontWeight: fontWeight.semibold,
        }}
      >
        {digit}
      </Animated.Text>
    </Animated.View>
  );
}

export function OtpInput({ length = 6, value, onChange }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('').slice(0, length);
  const boxSize = length <= 6 ? 48 : 40;

  return (
    <Pressable style={styles.container} onPress={() => inputRef.current?.focus()}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          const clean = text.replace(/\D/g, '').slice(0, length);
          onChange(clean);
        }}
        keyboardType="number-pad"
        maxLength={length}
        style={styles.hidden}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
      />

      <View style={styles.boxes}>
        {Array.from({ length }).map((_, i) => (
          <OtpBox
            key={i}
            digit={digits[i] ?? ''}
            isActive={focused && i === Math.min(digits.length, length - 1)}
            isFilled={i < digits.length}
            shake={false}
            boxSize={boxSize}
          />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  boxes: { flexDirection: 'row', gap: 10 },
  box: { alignItems: 'center', justifyContent: 'center' },
});
