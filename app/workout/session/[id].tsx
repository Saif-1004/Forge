import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { database } from '@/lib/watermelon/database';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { WorkoutSession, SessionExercise, Set as SetModel, Exercise } from '@/lib/watermelon/models';

interface SetDetail {
  setNumber: number;
  reps: number;
  weight: number;
  unit: string;
  isWarmup: boolean;
}

interface ExerciseDetail {
  seId: string;
  exerciseName: string;
  musclePrimary: string[];
  sets: SetDetail[];
}

interface SessionDetail {
  startedAt: number;
  endedAt: number | null;
  exercises: ExerciseDetail[];
  totalSets: number;
  totalVolume: number;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuration(startMs: number, endMs: number): string {
  const m = Math.round((endMs - startMs) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function SessionDetailScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const sessionsCollection = database.collections.get<WorkoutSession>('workout_sessions');
        const seCollection = database.collections.get<SessionExercise>('session_exercises');
        const exercisesCollection = database.collections.get<Exercise>('exercises');

        const session = await sessionsCollection.find(id);
        const sessionExercises = await seCollection
          .query(Q.where('session_id', id), Q.where('is_deleted', false), Q.sortBy('order_index', Q.asc))
          .fetch();

        let totalSets = 0;
        let totalVolume = 0;
        const exercises: ExerciseDetail[] = [];

        for (const se of sessionExercises) {
          const setsRaw = await se.sets.fetch() as SetModel[];
          const activeSets = setsRaw
            .filter((s) => !s.isDeleted)
            .sort((a, b) => a.setNumber - b.setNumber);

          let exerciseName = 'Unknown Exercise';
          let musclePrimary: string[] = [];
          try {
            const ex = await exercisesCollection.find(se.exerciseId);
            exerciseName = ex.name;
            musclePrimary = ex.musclePrimary;
          } catch {}

          const setDetails: SetDetail[] = activeSets.map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            unit: s.unit,
            isWarmup: s.isWarmup,
          }));

          totalSets += setDetails.length;
          totalVolume += setDetails.reduce((acc, s) => acc + s.reps * s.weight, 0);

          exercises.push({ seId: se.id, exerciseName, musclePrimary, sets: setDetails });
        }

        setDetail({ startedAt: session.startedAt, endedAt: session.endedAt, exercises, totalSets, totalVolume });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, paddingHorizontal: spacing[5], paddingBottom: spacing[3], borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3] }}>
          Session
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : notFound || !detail ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>Session not found.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[5],
            paddingBottom: insets.bottom + 32,
          }}
        >
          {/* Date + duration */}
          <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
            {formatDate(detail.startedAt)}
          </Text>
          <View style={[styles.statsRow, { marginTop: spacing[3], marginBottom: spacing[6] }]}>
            {detail.endedAt && (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {formatDuration(detail.startedAt, detail.endedAt)}
              </Text>
            )}
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {detail.totalSets} set{detail.totalSets !== 1 ? 's' : ''}
            </Text>
            {detail.totalVolume > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {detail.totalVolume.toLocaleString()} kg total
              </Text>
            )}
          </View>

          {/* Exercises */}
          {detail.exercises.map((ex) => (
            <View
              key={ex.seId}
              style={[
                styles.exerciseCard,
                {
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  padding: spacing[4],
                  marginBottom: spacing[4],
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 2 }}>
                {ex.exerciseName}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing[3] }}>
                {ex.musclePrimary.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
              </Text>

              {/* Set table header */}
              <View style={[styles.setTableRow, { marginBottom: spacing[1] }]}>
                <Text style={[styles.setCell, { color: colors.textMuted, fontSize: fontSize.xs }]}>#</Text>
                <Text style={[styles.setCell, styles.setCellWide, { color: colors.textMuted, fontSize: fontSize.xs }]}>Reps</Text>
                <Text style={[styles.setCell, styles.setCellWide, { color: colors.textMuted, fontSize: fontSize.xs }]}>Weight</Text>
                <Text style={[styles.setCell, styles.setCellWide, { color: colors.textMuted, fontSize: fontSize.xs }]}>Volume</Text>
              </View>

              {ex.sets.map((s) => (
                <View key={s.setNumber} style={[styles.setTableRow, { paddingVertical: 3 }]}>
                  <Text style={[styles.setCell, { color: s.isWarmup ? colors.textMuted : colors.text, fontSize: fontSize.sm }]}>
                    {s.isWarmup ? 'W' : s.setNumber}
                  </Text>
                  <Text style={[styles.setCell, styles.setCellWide, { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                    {s.reps}
                  </Text>
                  <Text style={[styles.setCell, styles.setCellWide, { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                    {s.weight} {s.unit}
                  </Text>
                  <Text style={[styles.setCell, styles.setCellWide, { color: colors.textMuted, fontSize: fontSize.sm }]}>
                    {(s.reps * s.weight).toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 16 },
  exerciseCard: { borderWidth: 1 },
  setTableRow: { flexDirection: 'row', alignItems: 'center' },
  setCell: { width: 28, textAlign: 'center' },
  setCellWide: { width: 64 },
});
