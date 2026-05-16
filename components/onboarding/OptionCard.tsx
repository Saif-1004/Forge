import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';

interface OptionCardProps {
  label: string;
  description?: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
  multiSelect?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function OptionCard({ label, description, emoji, selected, onPress, multiSelect }: OptionCardProps) {
  const { colors, radius, fontSize, fontWeight } = useTheme();
  const scale = useSharedValue(1);
  const fill = useSharedValue(selected ? 1 : 0);

  React.useEffect(() => {
    fill.value = withTiming(selected ? 1 : 0, { duration: 200 });
  }, [selected]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(fill.value, [0, 1], [colors.surface, colors.accent]),
    borderColor: interpolateColor(fill.value, [0, 1], [colors.border, colors.accent]),
  }));

  const labelColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(fill.value, [0, 1], [colors.text, colors.accentForeground]),
  }));

  const descColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(fill.value, [0, 1], [colors.textMuted, colors.accentForeground]),
  }));

  const handlePress = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 }, () => {
      scale.value = withSpring(1.02, { damping: 20, stiffness: 300 }, () => {
        scale.value = withSpring(1, { damping: 20, stiffness: 300 });
      });
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[styles.card, { borderRadius: radius.lg, borderWidth: 1 }, animStyle]}
    >
      <View style={styles.row}>
        {emoji && (
          <Text style={[styles.emoji, { fontSize: fontSize.xl }]}>{emoji}</Text>
        )}
        <View style={styles.content}>
          <Animated.Text style={[styles.label, { fontSize: fontSize.base, fontWeight: fontWeight.medium }, labelColorStyle]}>
            {label}
          </Animated.Text>
          {description && (
            <Animated.Text style={[styles.desc, { fontSize: fontSize.sm }, descColorStyle]}>
              {description}
            </Animated.Text>
          )}
        </View>
        {multiSelect && (
          <Checkmark visible={selected} accentForeground={colors.accentForeground} />
        )}
      </View>
    </AnimatedPressable>
  );
}

function Checkmark({ visible, accentForeground }: { visible: boolean; accentForeground: string }) {
  const scale = useSharedValue(visible ? 1 : 0);
  React.useEffect(() => {
    scale.value = visible
      ? withSpring(1, { damping: 12, stiffness: 300 })
      : withSpring(0, { damping: 20, stiffness: 300 });
  }, [visible]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.Text style={[{ color: accentForeground, fontSize: 18, marginLeft: 8 }, style]}>✓</Animated.Text>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { marginRight: 12 },
  content: { flex: 1 },
  label: { marginBottom: 2 },
  desc: { opacity: 0.8 },
});
