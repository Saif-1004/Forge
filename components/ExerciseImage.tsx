import { useState, useEffect, useRef } from 'react';
import { View, Image, ActivityIndicator } from 'react-native';
import { getExerciseImageUrls } from '@/data/exerciseImages';
import { BodyDiagram } from '@/components/BodyDiagram';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  exerciseName: string;
  musclePrimary: string[];
  muscleSecondary: string[];
  width: number;
  height: number;
}

export function ExerciseImage({ exerciseName, musclePrimary, muscleSecondary, width, height }: Props) {
  const { colors } = useTheme();
  const urls = getExerciseImageUrls(exerciseName);
  const [frame, setFrame] = useState(0);
  const [frame0Loaded, setFrame0Loaded] = useState(false);
  const [frame1Loaded, setFrame1Loaded] = useState(false);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start animation once both frames are loaded
  useEffect(() => {
    if (!urls || error) return;
    if (frame0Loaded && frame1Loaded) {
      intervalRef.current = setInterval(() => {
        setFrame(f => (f === 0 ? 1 : 0));
      }, 900);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [frame0Loaded, frame1Loaded, urls, error]);

  // Reset on exercise change
  useEffect(() => {
    setFrame(0);
    setFrame0Loaded(false);
    setFrame1Loaded(false);
    setError(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [exerciseName]);

  if (!urls || error) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <BodyDiagram primary={musclePrimary} secondary={muscleSecondary} size={height} />
      </View>
    );
  }

  const bothLoaded = frame0Loaded && frame1Loaded;

  return (
    <View style={{ width, height, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {!bothLoaded && (
        <ActivityIndicator
          color={colors.textMuted}
          style={{ position: 'absolute', zIndex: 1 }}
        />
      )}
      {/* Frame 0 */}
      <Image
        source={{ uri: urls.frame0 }}
        style={{
          width, height,
          position: 'absolute',
          opacity: frame === 0 ? 1 : 0,
          resizeMode: 'cover',
        }}
        onLoad={() => setFrame0Loaded(true)}
        onError={() => setError(true)}
      />
      {/* Frame 1 — only fetch once frame 0 loaded */}
      {frame0Loaded && (
        <Image
          source={{ uri: urls.frame1 }}
          style={{
            width, height,
            position: 'absolute',
            opacity: frame === 1 ? 1 : 0,
            resizeMode: 'cover',
          }}
          onLoad={() => setFrame1Loaded(true)}
          onError={() => {}}
        />
      )}
    </View>
  );
}
