import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/useTheme';
import { useWorkoutStore, type ActiveExercise, type ActiveSet } from '@/store/workoutStore';
import { useSyncStore } from '@/store/syncStore';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ─── Set Row ────────────────────────────────────────────────────────────────

function formatDurationDisplay(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

interface SetRowProps {
  set: ActiveSet;
  seId: string;
  isCardio: boolean;
  onUpdate: (seId: string, setId: string, data: Partial<ActiveSet>) => void;
  onLog: (seId: string, setId: string) => void;
  onDelete: (seId: string, setId: string) => void;
}

function SetRow({ set, seId, isCardio, onUpdate, onLog, onDelete }: SetRowProps) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const logged = set.loggedAt !== null;

  const totalSec = set.durationSeconds ?? 0;
  const durationMins = String(Math.floor(totalSec / 60));
  const durationSecs = String(totalSec % 60);

  return (
    <View
      style={[
        styles.setRow,
        {
          backgroundColor: logged ? colors.surface : colors.background,
          borderRadius: radius.md,
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          marginBottom: spacing[2],
          borderWidth: 1,
          borderColor: logged ? colors.success + '44' : colors.border,
        },
      ]}
    >
      {/* Set number */}
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, width: 24, textAlign: 'center' }}>
        {set.setNumber}
      </Text>

      {isCardio ? (
        /* Duration inputs: minutes + seconds */
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginLeft: spacing[3], gap: spacing[2] }}>
          <View style={styles.inputWrap}>
            <TextInput
              value={durationMins}
              onChangeText={(v) => {
                const m = parseInt(v) || 0;
                const s = totalSec % 60;
                onUpdate(seId, set.id, { durationSeconds: m * 60 + s });
              }}
              keyboardType="number-pad"
              editable={!logged}
              style={[styles.setInput, { color: logged ? colors.textMuted : colors.text, backgroundColor: colors.surface, fontSize: fontSize.base, fontWeight: fontWeight.medium, borderRadius: radius.sm, textAlign: 'center', paddingVertical: spacing[1] }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>min</Text>
          </View>
          <View style={styles.inputWrap}>
            <TextInput
              value={durationSecs}
              onChangeText={(v) => {
                const s = Math.min(parseInt(v) || 0, 59);
                const m = Math.floor(totalSec / 60);
                onUpdate(seId, set.id, { durationSeconds: m * 60 + s });
              }}
              keyboardType="number-pad"
              editable={!logged}
              style={[styles.setInput, { color: logged ? colors.textMuted : colors.text, backgroundColor: colors.surface, fontSize: fontSize.base, fontWeight: fontWeight.medium, borderRadius: radius.sm, textAlign: 'center', paddingVertical: spacing[1] }]}
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
              editable={!logged}
              style={[styles.setInput, { color: logged ? colors.textMuted : colors.text, backgroundColor: colors.surface, fontSize: fontSize.base, fontWeight: fontWeight.medium, borderRadius: radius.sm, textAlign: 'center', paddingVertical: spacing[1] }]}
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
              editable={!logged}
              style={[styles.setInput, { color: logged ? colors.textMuted : colors.text, backgroundColor: colors.surface, fontSize: fontSize.base, fontWeight: fontWeight.medium, borderRadius: radius.sm, textAlign: 'center', paddingVertical: spacing[1] }]}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>{set.unit}</Text>
          </View>
        </>
      )}

      {/* Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: spacing[2] }}>
        {!logged ? (
          <Pressable
            onPress={() => onLog(seId, set.id)}
            style={[styles.logBtn, { backgroundColor: colors.text, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }]}
          >
            <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Log</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {set.isPR && (
              <View style={{ backgroundColor: '#F59E0B', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>PR</Text>
              </View>
            )}
            {isCardio && logged && set.durationSeconds != null && set.durationSeconds > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{formatDurationDisplay(set.durationSeconds)}</Text>
            )}
            <Text style={{ color: colors.success, fontSize: fontSize.lg }}>✓</Text>
          </View>
        )}
        <Pressable onPress={() => onDelete(seId, set.id)} hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Rest Timer Panel ────────────────────────────────────────────────────────

function formatCountdown(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface RestTimerProps {
  secondsLeft: number;
  total: number;
  onSkip: () => void;
  onAdd: (extra: number) => void;
}

function RestTimerPanel({ secondsLeft, total, onSkip, onAdd }: RestTimerProps) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const progress = total > 0 ? secondsLeft / total : 0;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: spacing[5],
        paddingTop: spacing[3],
        paddingBottom: spacing[2],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 0.6 }}>
          REST
        </Text>
        <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, letterSpacing: -0.5 }}>
          {formatCountdown(secondsLeft)}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing[2] }}>
          <Pressable
            onPress={() => onAdd(30)}
            style={[styles.timerBtn, { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }]}
          >
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>+30s</Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            style={[styles.timerBtn, { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }]}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Skip</Text>
          </Pressable>
        </View>
      </View>
      {/* Progress bar */}
      <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2 }}>
        <View style={{ height: 3, width: `${progress * 100}%`, backgroundColor: colors.text, borderRadius: 2 }} />
      </View>
    </View>
  );
}

// ─── Exercise Card ───────────────────────────────────────────────────────────

interface ExerciseCardProps {
  exercise: ActiveExercise;
  onAddSet: (seId: string) => void;
  onRemove: (seId: string) => void;
  onUpdate: (seId: string, setId: string, data: Partial<ActiveSet>) => void;
  onLog: (seId: string, setId: string) => void;
  onDeleteSet: (seId: string, setId: string) => void;
}

function ExerciseCard({ exercise, onAddSet, onRemove, onUpdate, onLog, onDeleteSet }: ExerciseCardProps) {
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
      {/* Exercise name + remove */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
            {exercise.exerciseName}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 }}>
            {exercise.musclePrimary.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
          </Text>
        </View>
        <Pressable onPress={() => onRemove(exercise.sessionExerciseId)} hitSlop={8}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.lg }}>×</Text>
        </Pressable>
      </View>

      {/* Column labels */}
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

      {/* Sets */}
      {exercise.sets.map((s) => (
        <SetRow
          key={s.id}
          set={s}
          seId={exercise.sessionExerciseId}
          isCardio={isCardio}
          onUpdate={onUpdate}
          onLog={onLog}
          onDelete={onDeleteSet}
        />
      ))}

      {/* Add Set */}
      <Pressable
        onPress={() => onAddSet(exercise.sessionExerciseId)}
        style={[
          styles.addSetBtn,
          {
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: spacing[2],
            marginTop: spacing[1],
          },
        ]}
      >
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{isCardio ? '+ Add Interval' : '+ Add Set'}</Text>
      </Pressable>
    </View>
  );
}

// ─── Active Workout Screen ────────────────────────────────────────────────────

export default function ActiveWorkoutScreen() {
  const { colors, fontSize, fontWeight, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { sync } = useSyncStore();
  const { defaultRestSeconds } = useSettingsStore();
  const {
    exercises,
    isPaused,
    getElapsed,
    pauseSession,
    resumeSession,
    removeExercise,
    addSet,
    updateSet,
    logSet,
    deleteSet,
    finishSession,
    discardSession,
  } = useWorkoutStore();

  const [elapsed, setElapsed] = useState(getElapsed);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rest timer
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(defaultRestSeconds);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRestTimer = useCallback((seconds: number) => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestTotal(seconds);
    setRestLeft(seconds);
    restIntervalRef.current = setInterval(() => {
      setRestLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(restIntervalRef.current!);
          restIntervalRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const skipRestTimer = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restIntervalRef.current = null;
    setRestLeft(null);
  }, []);

  const addRestTime = useCallback((extra: number) => {
    setRestLeft((prev) => {
      if (prev === null) return null;
      const next = prev + extra;
      setRestTotal((t) => t + extra);
      return next;
    });
  }, []);

  // Clean up rest timer on unmount
  useEffect(() => {
    return () => { if (restIntervalRef.current) clearInterval(restIntervalRef.current); };
  }, []);

  const handleLogSet = useCallback(async (seId: string, setId: string) => {
    const ex = exercises.find((e) => e.sessionExerciseId === seId);
    const targetSet = ex?.sets.find((s) => s.id === setId);
    await logSet(seId, setId);
    // Start rest timer for non-warmup, non-cardio sets
    if (targetSet && !targetSet.isWarmup && !ex?.musclePrimary.includes('cardio')) {
      startRestTimer(defaultRestSeconds);
    }
  }, [exercises, logSet, startRestTimer, defaultRestSeconds]);

  // PR flash banner
  const [prBanner, setPrBanner] = useState<{ name: string; reps: number; weight: number; unit: string } | null>(null);
  const prTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevExercisesRef = useRef(exercises);
  useEffect(() => {
    const prev = prevExercisesRef.current;
    outer: for (const ex of exercises) {
      const prevEx = prev.find((e) => e.sessionExerciseId === ex.sessionExerciseId);
      for (const s of ex.sets) {
        if (s.isPR && s.loggedAt !== null) {
          const prevSet = prevEx?.sets.find((ps) => ps.id === s.id);
          if (!prevSet?.isPR) {
            setPrBanner({ name: ex.exerciseName, reps: s.reps, weight: s.weight, unit: s.unit });
            if (prTimerRef.current) clearTimeout(prTimerRef.current);
            prTimerRef.current = setTimeout(() => setPrBanner(null), 3000);
            break outer;
          }
        }
      }
    }
    prevExercisesRef.current = exercises;
  }, [exercises]);

  // Tick every second when running
  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setElapsed(getElapsed());
      return;
    }
    const tick = () => setElapsed(getElapsed());
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, getElapsed]);

  // Resume timer when screen gains focus (coming back from exercise-picker)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (!isPaused) setElapsed(getElapsed());
    });
    return unsub;
  }, [navigation, isPaused, getElapsed]);

  // Intercept back navigation
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      // Allow programmatic replaces (finish/discard handlers call router.replace)
      if ((e.data.action as { type: string }).type === 'REPLACE') return;
      e.preventDefault();
      Alert.alert(
        'Leave workout?',
        isPaused ? 'Timer is paused. What would you like to do?' : 'What would you like to do with your workout?',
        [
          { text: 'Keep Going', style: 'cancel' },
          {
            text: isPaused ? 'Go Back (Timer Paused)' : 'Pause Timer & Go Back',
            onPress: () => {
              if (!isPaused) pauseSession();
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'End Workout',
            onPress: () => {
              const totalLogged = exercises.reduce(
                (acc, ex) => acc + ex.sets.filter((s) => s.loggedAt !== null).length, 0,
              );
              Alert.alert(
                'End Workout?',
                totalLogged === 0 ? 'No sets logged yet.' : `${totalLogged} set${totalLogged !== 1 ? 's' : ''} logged.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'End',
                    onPress: async () => {
                      await finishSession();
                      if (user) sync(user.id).catch(() => {});
                      router.replace('/(tabs)/workout');
                    },
                  },
                ],
              );
            },
          },
        ],
      );
    });
    return unsub;
  }, [navigation, isPaused, pauseSession, exercises, finishSession, user, sync]);

  const handleFinish = useCallback(() => {
    const totalLogged = exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.loggedAt !== null).length, 0);
    const newPRs = exercises.flatMap((ex) =>
      ex.sets
        .filter((s) => s.isPR && s.loggedAt !== null)
        .map((s) => `${ex.exerciseName} — ${s.reps} rep${s.reps !== 1 ? 's' : ''} @ ${s.weight}${s.unit}`),
    );
    const prLine = newPRs.length > 0 ? `\n\n🏆 ${newPRs.length} new PR${newPRs.length !== 1 ? 's' : ''}:\n${newPRs.join('\n')}` : '';
    const body = totalLogged === 0 ? 'No sets logged yet.' : `${totalLogged} set${totalLogged !== 1 ? 's' : ''} logged.${prLine}`;

    Alert.alert('Finish Workout?', body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          await finishSession();
          if (user) sync(user.id).catch(() => {});
          router.replace('/(tabs)/workout');
        },
      },
    ]);
  }, [exercises, finishSession, user, sync]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard Workout?', 'This will delete all sets logged in this session.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await discardSession();
          router.replace('/(tabs)/workout');
        },
      },
    ]);
  }, [discardSession]);

  const handleRemoveExercise = useCallback(
    (seId: string) => {
      Alert.alert('Remove Exercise?', 'All sets for this exercise will be deleted.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeExercise(seId) },
      ]);
    },
    [removeExercise],
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            paddingBottom: spacing[3],
            paddingHorizontal: spacing[5],
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* Timer + pause toggle */}
        <Pressable onPress={isPaused ? resumeSession : pauseSession} hitSlop={8}>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
            {formatDuration(elapsed)}
          </Text>
          <Text style={{ color: isPaused ? colors.warning : colors.success, fontSize: fontSize.xs, marginTop: 1 }}>
            {isPaused ? '⏸ Paused — tap to resume' : '▶ Running'}
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: spacing[3] }}>
          <Pressable onPress={handleDiscard} hitSlop={8}>
            <Text style={{ color: colors.error, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>Discard</Text>
          </Pressable>
          <Pressable
            onPress={handleFinish}
            style={[
              styles.finishBtn,
              { backgroundColor: colors.text, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
            ]}
          >
            <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
              Finish
            </Text>
          </Pressable>
        </View>
      </View>

      {/* PR flash banner */}
      {prBanner && (
        <View style={{ backgroundColor: '#F59E0B', paddingVertical: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>🏆 NEW PR!</Text>
          <Text style={{ color: '#fff', fontSize: 13, flex: 1 }} numberOfLines={1}>
            {prBanner.name} · {prBanner.reps} rep{prBanner.reps !== 1 ? 's' : ''} @ {prBanner.weight}{prBanner.unit}
          </Text>
        </View>
      )}

      {/* Exercise list */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingTop: spacing[5],
          paddingBottom: insets.bottom + 100,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {exercises.length === 0 ? (
          <View style={[styles.empty, { marginTop: spacing[16] }]}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
              No exercises added yet.{'\n'}Tap below to get started.
            </Text>
          </View>
        ) : (
          exercises.map((ex) => (
            <ExerciseCard
              key={ex.sessionExerciseId}
              exercise={ex}
              onAddSet={addSet}
              onRemove={handleRemoveExercise}
              onUpdate={updateSet}
              onLog={handleLogSet}
              onDeleteSet={deleteSet}
            />
          ))
        )}
      </ScrollView>

      {/* Rest Timer */}
      {restLeft !== null && (
        <RestTimerPanel
          secondsLeft={restLeft}
          total={restTotal}
          onSkip={skipRestTimer}
          onAdd={addRestTime}
        />
      )}

      {/* Add Exercise FAB */}
      <View
        style={[
          styles.fab,
          {
            bottom: insets.bottom + 24,
            left: spacing[5],
            right: spacing[5],
            backgroundColor: colors.text,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push('/workout/exercise-picker')}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: {},
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center' },
  inputWrap: { alignItems: 'center', width: 56 },
  setInput: { width: '100%' },
  logBtn: {},
  addSetBtn: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
  finishBtn: { borderRadius: 8 },
  fab: { position: 'absolute', borderRadius: 12 },
  empty: { alignItems: 'center' },
  timerBtn: { borderWidth: 1 },
});
