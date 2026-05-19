import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { supabase } from '@/lib/supabase/client';
import { database } from '@/lib/watermelon/database';
import type { Exercise, PersonalRecord } from '@/lib/watermelon/models';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';

interface PlannedExercise {
  id: string;
  name: string;
  musclePrimary: string[];
  bestSet: { weight: number; reps: number; unit: string } | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function PlannedWorkoutScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const { user, unitPreference } = useAuthStore();
  const { isActive, startSession } = useWorkoutStore();

  const [muscles, setMuscles] = useState<string[]>([]);
  const [exercises, setExercises] = useState<PlannedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!user || !date) return;
    setLoading(true);
    try {
      // Load the plan from Supabase
      const { data: plan } = await supabase
        .from('planned_workouts')
        .select('muscle_groups, exercise_ids')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();

      if (!plan) { setLoading(false); return; }
      setMuscles(plan.muscle_groups ?? []);

      const ids: string[] = (plan as any).exercise_ids ?? [];
      if (ids.length === 0) { setLoading(false); return; }

      // Look up exercises in WatermelonDB
      const exCol = database.collections.get<Exercise>('exercises');
      const prCol = database.collections.get<PersonalRecord>('personal_records');

      const found = await Promise.allSettled(ids.map(id => exCol.find(id)));
      const resolved: Exercise[] = found.filter((r): r is PromiseFulfilledResult<Exercise> => r.status === 'fulfilled').map(r => r.value);

      // Load best sets (PRs) for each exercise
      const allPRs = await prCol
        .query(Q.where('user_id', user.id), Q.where('exercise_id', Q.oneOf(resolved.map(e => e.id))), Q.where('is_deleted', false))
        .fetch();

      const prByExercise = new Map<string, { weight: number; reps: number; unit: string }>();
      for (const pr of allPRs) {
        const existing = prByExercise.get(pr.exerciseId);
        // Pick the 1-rep-max equivalent best: favour heavier weight at low reps
        if (!existing || pr.weight > existing.weight) {
          prByExercise.set(pr.exerciseId, { weight: pr.weight, reps: pr.repCount, unit: pr.unit });
        }
      }

      setExercises(resolved.map(ex => ({
        id: ex.id,
        name: ex.name,
        musclePrimary: ex.musclePrimary,
        bestSet: prByExercise.get(ex.id) ?? null,
      })));
    } finally {
      setLoading(false);
    }
  }, [user, date]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    if (!user) return;
    if (isActive) {
      Alert.alert('Workout in progress', 'You already have an active workout. Finish or discard it first.', [
        { text: 'OK' },
        { text: 'Go to workout', onPress: () => router.push('/workout/active') },
      ]);
      return;
    }
    setStarting(true);
    try {
      await startSession(user.id, unitPreference);
      for (const ex of exercises) {
        await useWorkoutStore.getState().addExercise({
          id: ex.id,
          name: ex.name,
          musclePrimary: ex.musclePrimary,
        });
        // Pre-fill 3 default sets based on best performance
        const { exercises: current } = useWorkoutStore.getState();
        const added = current.find(e => e.exerciseId === ex.id);
        if (added) {
          const defaultSets = 3;
          for (let i = 0; i < defaultSets; i++) {
            useWorkoutStore.getState().addSet(added.sessionExerciseId);
            if (ex.bestSet) {
              const newEx = useWorkoutStore.getState().exercises.find(e => e.sessionExerciseId === added.sessionExerciseId);
              const lastSet = newEx?.sets[newEx.sets.length - 1];
              if (lastSet) {
                useWorkoutStore.getState().updateSet(added.sessionExerciseId, lastSet.id, {
                  reps: ex.bestSet.reps,
                  weight: ex.bestSet.weight,
                  unit: ex.bestSet.unit as 'kg' | 'lbs',
                });
              }
            }
          }
        }
      }
      router.replace('/workout/active');
    } catch {
      Alert.alert('Error', 'Could not start workout. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const handleStartEmpty = async () => {
    if (!user) return;
    if (isActive) {
      router.push('/workout/active');
      return;
    }
    setStarting(true);
    try {
      await startSession(user.id, unitPreference);
      router.replace('/workout/active');
    } finally {
      setStarting(false);
    }
  };

  const s = spacing;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: s[5], paddingBottom: s[3], borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: s[3] }}>Planned Workout</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.text} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: s[5], paddingBottom: s[3], borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <View style={{ flex: 1, marginLeft: s[3] }}>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Planned Workout</Text>
          {date && <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>{formatDate(date)}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: s[5], paddingTop: s[5], paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* Muscle group chips */}
        {muscles.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s[2], marginBottom: s[5] }}>
            {muscles.map(m => (
              <View key={m} style={{ backgroundColor: colors.warning + '22', borderRadius: radius.md, paddingHorizontal: s[3], paddingVertical: s[1] }}>
                <Text style={{ color: colors.warning, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>{m}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Exercise count */}
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: s[3] }}>
          {exercises.length > 0 ? `${exercises.length} EXERCISE${exercises.length !== 1 ? 'S' : ''}` : 'NO EXERCISES SELECTED'}
        </Text>

        {/* Exercise list */}
        {exercises.length > 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: s[4] }}>
            {exercises.map((ex, i) => (
              <View
                key={ex.id}
                style={[
                  styles.exerciseRow,
                  {
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                    paddingHorizontal: s[4],
                    paddingVertical: s[4],
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium, marginBottom: 3 }}>
                    {ex.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                    {ex.musclePrimary.map(m => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 2 }}>3 sets</Text>
                  {ex.bestSet ? (
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                      {ex.bestSet.weight}{ex.bestSet.unit} × {ex.bestSet.reps}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>No history</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: s[5], alignItems: 'center', marginBottom: s[4] }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
              No exercises were saved with this plan.{'\n'}You can still start an empty workout.
            </Text>
          </View>
        )}

        {/* PR note */}
        {exercises.some(e => e.bestSet) && (
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', marginBottom: s[2] }}>
            Weights shown are your previous best · adjust as needed
          </Text>
        )}
      </ScrollView>

      {/* Footer actions */}
      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16, paddingHorizontal: s[5], paddingTop: s[4], borderTopColor: colors.border }]}>
        {exercises.length > 0 && (
          <Pressable
            onPress={handleStart}
            disabled={starting}
            style={({ pressed }) => ({
              backgroundColor: colors.text,
              borderRadius: radius.lg,
              paddingVertical: s[4],
              marginBottom: s[3],
              opacity: pressed || starting ? 0.8 : 1,
              alignItems: 'center',
            })}
          >
            {starting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={{ color: colors.background, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
                Start Planned Workout
              </Text>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={handleStartEmpty}
          disabled={starting}
          style={({ pressed }) => ({
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            paddingVertical: s[4],
            opacity: pressed ? 0.7 : 1,
            alignItems: 'center',
          })}
        >
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>Start Empty Workout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center' },
  footer: { borderTopWidth: 1 },
});
