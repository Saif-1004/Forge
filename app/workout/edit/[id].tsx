import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutStore } from '@/store/workoutStore';
import { useSyncStore } from '@/store/syncStore';
import { useAuthStore } from '@/store/authStore';
import { database } from '@/lib/watermelon/database';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { WorkoutSession, SessionExercise, Set as SetModel, Exercise } from '@/lib/watermelon/models';

interface EditableSet {
  id: string;           // WatermelonDB local id
  setNumber: number;
  reps: number;
  weight: number;
  unit: 'lbs' | 'kg';
  isWarmup: boolean;
  durationSeconds: number | null;
  isNew: boolean;       // true = not yet persisted to DB
}


interface EditableExercise {
  seId: string;
  exerciseId: string;
  exerciseName: string;
  musclePrimary: string[];
  orderIndex: number;
  sets: EditableSet[];
}

// ─── Set Row ─────────────────────────────────────────────────────────────────

function SetRow({
  set, seId, isCardio,
  onUpdate, onDelete,
}: {
  set: EditableSet;
  seId: string;
  isCardio: boolean;
  onUpdate: (seId: string, setId: string, data: Partial<EditableSet>) => void;
  onDelete: (seId: string, setId: string) => void;
}) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const totalSec = set.durationSeconds ?? 0;

  return (
    <View
      style={[
        styles.setRow,
        {
          backgroundColor: colors.background,
          borderRadius: radius.md,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          marginBottom: spacing[2],
          borderWidth: 1,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, width: 24, textAlign: 'center' }}>
        {set.isWarmup ? 'W' : set.setNumber}
      </Text>

      {isCardio ? (
        /* Duration inputs */
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginLeft: spacing[3], gap: spacing[2] }}>
          <View style={styles.inputWrap}>
            <TextInput
              value={String(Math.floor(totalSec / 60))}
              onChangeText={(v) => {
                const m = parseInt(v) || 0;
                const s = totalSec % 60;
                onUpdate(seId, set.id, { durationSeconds: m * 60 + s });
              }}
              keyboardType="number-pad"
              style={[styles.setInput, { color: colors.text, backgroundColor: colors.surface, fontSize: fontSize.base, fontWeight: fontWeight.medium, borderRadius: radius.sm, textAlign: 'center', paddingVertical: spacing[1] }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>min</Text>
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              value={String(totalSec % 60)}
              onChangeText={(v) => {
                const s = Math.min(parseInt(v) || 0, 59);
                const m = Math.floor(totalSec / 60);
                onUpdate(seId, set.id, { durationSeconds: m * 60 + s });
              }}
              keyboardType="number-pad"
              style={[styles.setInput, { color: colors.text, backgroundColor: colors.surface, fontSize: fontSize.base, fontWeight: fontWeight.medium, borderRadius: radius.sm, textAlign: 'center', paddingVertical: spacing[1] }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>sec</Text>
          </View>
        </View>
      ) : (
        <>
          {/* Reps */}
          <View style={[styles.inputWrap, { marginLeft: spacing[3] }]}>
            <TextInput
              value={set.reps > 0 ? String(set.reps) : ''}
              onChangeText={(v) => onUpdate(seId, set.id, { reps: parseInt(v) || 0 })}
              keyboardType="number-pad"
              style={[styles.setInput, { color: colors.text, backgroundColor: colors.surface, fontSize: fontSize.base, fontWeight: fontWeight.medium, borderRadius: radius.sm, textAlign: 'center', paddingVertical: spacing[1] }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>reps</Text>
          </View>
          {/* Weight */}
          <View style={[styles.inputWrap, { marginLeft: spacing[3] }]}>
            <TextInput
              value={set.weight > 0 ? String(set.weight) : ''}
              onChangeText={(v) => onUpdate(seId, set.id, { weight: parseFloat(v) || 0 })}
              keyboardType="decimal-pad"
              style={[styles.setInput, { color: colors.text, backgroundColor: colors.surface, fontSize: fontSize.base, fontWeight: fontWeight.medium, borderRadius: radius.sm, textAlign: 'center', paddingVertical: spacing[1] }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>{set.unit}</Text>
          </View>
        </>
      )}

      {/* Warmup toggle + delete */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: spacing[2] }}>
        {!isCardio && (
          <Pressable
            onPress={() => onUpdate(seId, set.id, { isWarmup: !set.isWarmup })}
            style={[
              styles.warmupBtn,
              {
                borderRadius: radius.sm,
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                borderWidth: 1,
                borderColor: set.isWarmup ? colors.warning : colors.border,
                backgroundColor: set.isWarmup ? colors.warning + '22' : 'transparent',
              },
            ]}
          >
            <Text style={{ color: set.isWarmup ? colors.warning : colors.textMuted, fontSize: fontSize.xs }}>W</Text>
          </Pressable>
        )}
        <Pressable onPress={() => onDelete(seId, set.id)} hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onRemove,
}: {
  exercise: EditableExercise;
  onAddSet: (seId: string) => void;
  onUpdateSet: (seId: string, setId: string, data: Partial<EditableSet>) => void;
  onDeleteSet: (seId: string, setId: string) => void;
  onRemove: (seId: string) => void;
}) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const isCardio = exercise.musclePrimary.includes('cardio');

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing[4],
          marginBottom: spacing[4],
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
            {exercise.exerciseName}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 }}>
            {exercise.musclePrimary.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
          </Text>
        </View>
        <Pressable onPress={() => onRemove(exercise.seId)} hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.lg }}>×</Text>
        </Pressable>
      </View>

      {exercise.sets.length > 0 && (
        <View style={[styles.setRow, { paddingHorizontal: spacing[3], marginBottom: spacing[1] }]}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, width: 24, textAlign: 'center' }}>#</Text>
          {isCardio ? (
            <>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, width: 56, textAlign: 'center', marginLeft: spacing[3] }}>Min</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, width: 56, textAlign: 'center', marginLeft: spacing[2] }}>Sec</Text>
            </>
          ) : (
            <>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, width: 56, textAlign: 'center', marginLeft: spacing[3] }}>Reps</Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, width: 64, textAlign: 'center', marginLeft: spacing[3] }}>Weight</Text>
            </>
          )}
        </View>
      )}

      {exercise.sets.map((s) => (
        <SetRow key={s.id} set={s} seId={exercise.seId} isCardio={isCardio} onUpdate={onUpdateSet} onDelete={onDeleteSet} />
      ))}

      <Pressable
        onPress={() => onAddSet(exercise.seId)}
        style={[
          styles.addSetBtn,
          { borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[2], marginTop: spacing[1] },
        ]}
      >
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{isCardio ? '+ Add Interval' : '+ Add Set'}</Text>
      </Pressable>
    </View>
  );
}

// ─── Edit Session Screen ──────────────────────────────────────────────────────

export default function EditSessionScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { sync } = useSyncStore();
  const { defaultUnit } = useWorkoutStore();

  const navigation = useNavigation();
  const [exercises, setExercises] = useState<EditableExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Track which sets/exercises to delete from DB on save
  const deletedSetIds = useRef(new Set<string>()).current;
  const deletedSeIds = useRef(new Set<string>()).current;

  const loadExercises = useCallback(async () => {
    if (!id) return;
    const seCol = database.collections.get<SessionExercise>('session_exercises');
    const setsCol = database.collections.get<SetModel>('sets');
    const exCol = database.collections.get<Exercise>('exercises');

    const ses = await seCol
      .query(Q.where('session_id', id), Q.where('is_deleted', false), Q.sortBy('order_index', Q.asc))
      .fetch();

    const loaded: EditableExercise[] = await Promise.all(
      ses.map(async (se) => {
        const setsRaw = await setsCol
          .query(Q.where('session_exercise_id', se.id), Q.where('is_deleted', false))
          .fetch();
        const activeSets = setsRaw
          .sort((a, b) => a.setNumber - b.setNumber)
          .map((s) => ({
            id: s.id,
            setNumber: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            unit: s.unit,
            isWarmup: s.isWarmup,
            durationSeconds: s.durationSeconds ?? null,
            isNew: false,
          }));

        let exerciseName = 'Unknown Exercise';
        let musclePrimary: string[] = [];
        try {
          const ex = await exCol.find(se.exerciseId);
          exerciseName = ex.name;
          musclePrimary = ex.musclePrimary;
        } catch {}

        return {
          seId: se.id,
          exerciseId: se.exerciseId,
          exerciseName,
          musclePrimary,
          orderIndex: se.orderIndex,
          sets: activeSets,
        };
      }),
    );

    setExercises(loaded);
    setLoading(false);
  }, [id]);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  // Reload when returning from exercise-picker (new exercise was added to DB)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (!loading) loadExercises();
    });
    return unsub;
  }, [navigation, loading, loadExercises]);

  const handleAddSet = useCallback((seId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.seId !== seId) return ex;
        const prev_ = ex.sets[ex.sets.length - 1];
        const newSet: EditableSet = {
          id: `new_${Date.now()}_${Math.random()}`,
          setNumber: ex.sets.length + 1,
          reps: prev_?.reps ?? 10,
          weight: prev_?.weight ?? 0,
          unit: prev_?.unit ?? defaultUnit,
          isWarmup: false,
          durationSeconds: prev_?.durationSeconds ?? null,
          isNew: true,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      }),
    );
  }, [defaultUnit]);

  const handleUpdateSet = useCallback((seId: string, setId: string, data: Partial<EditableSet>) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.seId !== seId) return ex;
        return { ...ex, sets: ex.sets.map((s) => s.id === setId ? { ...s, ...data } : s) };
      }),
    );
  }, []);

  const handleDeleteSet = useCallback((seId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.seId !== seId) return ex;
        const filtered = ex.sets.filter((s) => s.id !== setId);
        // Track for DB deletion unless it's a new (unsaved) set
        const target = ex.sets.find((s) => s.id === setId);
        if (target && !target.isNew) deletedSetIds.add(setId);
        return { ...ex, sets: filtered.map((s, i) => ({ ...s, setNumber: i + 1 })) };
      }),
    );
  }, [deletedSetIds]);

  const handleRemoveExercise = useCallback((seId: string) => {
    Alert.alert('Remove Exercise?', 'All sets for this exercise will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setExercises((prev) => {
            const target = prev.find((e) => e.seId === seId);
            if (target) {
              target.sets.filter((s) => !s.isNew).forEach((s) => deletedSetIds.add(s.id));
              deletedSeIds.add(seId);
            }
            return prev.filter((e) => e.seId !== seId);
          });
        },
      },
    ]);
  }, [deletedSetIds, deletedSeIds]);

  const handleAddExercise = useCallback(() => {
    // Pass session id so exercise-picker can add directly to this session
    router.push({ pathname: '/workout/exercise-picker', params: { editSessionId: id } });
  }, [id]);

  const handleSave = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const setsCol = database.collections.get<SetModel>('sets');
      const seCol = database.collections.get<SessionExercise>('session_exercises');

      await database.write(async () => {
        // 1. Delete removed sets
        for (const setId of deletedSetIds) {
          try {
            const r = await setsCol.find(setId);
            await r.destroyPermanently();
          } catch {}
        }

        // 2. Delete removed session exercises
        for (const seId of deletedSeIds) {
          try {
            const r = await seCol.find(seId);
            await r.destroyPermanently();
          } catch {}
        }

        // 3. Update / create sets for remaining exercises
        for (const ex of exercises) {
          for (const s of ex.sets) {
            if (s.isNew) {
              // Create new set record
              await setsCol.create((record) => {
                record.sessionExerciseId = ex.seId;
                record.setNumber = s.setNumber;
                record.reps = s.reps;
                record.weight = s.weight;
                record.unit = s.unit;
                record.rpe = null;
                record.isWarmup = s.isWarmup;
                record.durationSeconds = s.durationSeconds ?? null;
                record.completedAt = Date.now();
                record.isDeleted = false;
                record.remoteId = null;
                record.syncedAt = null;
              });
            } else {
              // Update existing set
              try {
                const record = await setsCol.find(s.id);
                await record.update((r) => {
                  r.setNumber = s.setNumber;
                  r.reps = s.reps;
                  r.weight = s.weight;
                  r.isWarmup = s.isWarmup;
                  r.durationSeconds = s.durationSeconds ?? null;
                  r.syncedAt = null; // mark dirty for re-sync
                });
              } catch {}
            }
          }
        }

        // 4. Mark session as needing re-sync
        try {
          const sessionsCol = database.collections.get<WorkoutSession>('workout_sessions');
          const session = await sessionsCol.find(id);
          await session.update((r) => { r.syncedAt = null; });
        } catch {}
      });

      // Trigger background sync
      if (user) sync(user.id).catch(() => {});

      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [id, exercises, deletedSetIds, deletedSeIds, user, sync]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, paddingBottom: spacing[3], paddingHorizontal: spacing[5], borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>Cancel</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>Edit Session</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[
            styles.saveBtn,
            { backgroundColor: colors.text, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[2], opacity: saving ? 0.6 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[5],
          paddingBottom: insets.bottom + 100,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {exercises.length === 0 ? (
          <View style={[styles.center, { marginTop: spacing[16] }]}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
              No exercises. Tap below to add one.
            </Text>
          </View>
        ) : (
          exercises.map((ex) => (
            <ExerciseCard
              key={ex.seId}
              exercise={ex}
              onAddSet={handleAddSet}
              onUpdateSet={handleUpdateSet}
              onDeleteSet={handleDeleteSet}
              onRemove={handleRemoveExercise}
            />
          ))
        )}
      </ScrollView>

      {/* Add Exercise FAB */}
      <View
        style={[
          styles.fab,
          { bottom: insets.bottom + 24, left: spacing[5], right: spacing[5], backgroundColor: colors.text },
        ]}
      >
        <Pressable
          onPress={handleAddExercise}
          style={{ paddingVertical: spacing[4], alignItems: 'center' }}
        >
          <Text style={{ color: colors.background, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
            + Add Exercise
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {},
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center' },
  inputWrap: { alignItems: 'center', width: 56 },
  setInput: { width: '100%' },
  warmupBtn: {},
  addSetBtn: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
  saveBtn: {},
  fab: { position: 'absolute', borderRadius: 12 },
});
