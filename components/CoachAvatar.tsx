import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface Props {
  size?: number;
}

export function CoachAvatar({ size = 80 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.06, duration: 700, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -5, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
        Animated.delay(1200),
      ]),
    ).start();
  }, [scale, translateY]);

  return (
    <Animated.Text style={{ fontSize: size, transform: [{ scale }, { translateY }] }}>
      🏋️‍♂️
    </Animated.Text>
  );
}
