import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { useSyncStore } from '@/store/syncStore';
import { database } from '@/lib/watermelon/database';
import type { WorkoutSession, SessionExercise, WorkoutTemplate, TemplateExercise, Exercise } from '@/lib/watermelon/models';

interface TemplateCard {
  id: string;
  name: string;
  exerciseCount: number;
  exercises: { exerciseId: string; exerciseName: string; defaultSets: number; defaultReps: number; defaultWeight: number; defaultUnit: string; orderIndex: number }[];
}

type DateFilter = 'week' | 'month' | 'all';

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

function getFilterCutoff(filter: DateFilter): number {
  const now = Date.now();
  if (filter === 'week') return now - 7 * 86400000;
  if (filter === 'month') return now - 30 * 86400000;
  return 0;
}

interface RecentSession {
  id: string;
  startedAt: number;
  endedAt: number;
  exerciseCount: number;
  setCount: number;
}

function formatDate(ms: number): string {
  const now = new Date();
  const d = new Date(ms);
  const diff = Math.floor((now.getTime() - ms) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDuration(startMs: number, endMs: number): string {
  const m = Math.round((endMs - startMs) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

export default function WorkoutTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, unitPreference } = useAuthStore();
  const { isActive, isPaused, getElapsed, exercises, startSession } = useWorkoutStore();
  const { status: syncStatus } = useSyncStore();

  const [allSessions, setAllSessions] = useState<RecentSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Elapsed timer for active session banner
  useEffect(() => {
    if (!isActive) { setElapsed(0); return; }
    if (isPaused) { setElapsed(getElapsed()); return; }
    const tick = () => setElapsed(getElapsed());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isActive, isPaused, getElapsed]);

  // Load sessions (more than 5 so filters work)
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const sessionsCollection = database.collections.get<WorkoutSession>('workout_sessions');
      const seCollection = database.collections.get<SessionExercise>('session_exercises');

      const raw = await sessionsCollection
        .query(
          Q.where('user_id', user.id),
          Q.where('is_deleted', false),
          Q.where('ended_at', Q.notEq(null)),
          Q.sortBy('started_at', Q.desc),
          Q.take(50),
        )
        .fetch();

      const rows = await Promise.all(
        raw.map(async (s) => {
          const ses = await seCollection
            .query(Q.where('session_id', s.id), Q.where('is_deleted', false))
            .fetch();
          let totalSets = 0;
          for (const se of ses) {
            const sets = await se.sets.fetch();
            totalSets += sets.filter((set) => !set.isDeleted).length;
          }
          return {
            id: s.id,
            startedAt: s.startedAt,
            endedAt: s.endedAt as number,
            exerciseCount: ses.length,
            setCount: totalSets,
          };
        }),
      );

      setAllSessions(rows);
      setLoadingHistory(false);
    };
    load();
  }, [user, isActive]);

  const filteredSessions = allSessions.filter(
    (s) => s.startedAt >= getFilterCutoff(dateFilter),
  );

  // Load templates
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingTemplates(true);
      try {
        const tCol = database.collections.get<WorkoutTemplate>('workout_templates');
        const teCol = database.collections.get<TemplateExercise>('template_exercises');
        const exCol = database.collections.get<Exercise>('exercises');

        const rawTemplates = await tCol
          .query(Q.where('user_id', user.id), Q.where('is_deleted', false), Q.sortBy('created_at', Q.desc))
          .fetch();

        const cards = await Promise.all(rawTemplates.map(async (t) => {
          const tes = await teCol
            .query(Q.where('template_id', t.id), Q.where('is_deleted', false), Q.sortBy('order_index', Q.asc))
            .fetch();
          const exercises = await Promise.all(tes.map(async (te) => {
            let exerciseName = 'Unknown';
            try { const ex = await exCol.find(te.exerciseId); exerciseName = ex.name; } catch {}
            return { exerciseId: te.exerciseId, exerciseName, defaultSets: te.defaultSets, defaultReps: te.defaultReps, defaultWeight: te.defaultWeight, defaultUnit: te.defaultUnit, orderIndex: te.orderIndex };
          }));
          return { id: t.id, name: t.name, exerciseCount: exercises.length, exercises };
        }));

        setTemplates(cards);
      } finally {
        setLoadingTemplates(false);
      }
    };
    load();
  }, [user]);

  const handleStartFromTemplate = useCallback(async (template: TemplateCard) => {
    if (!user) return;
    setStarting(true);
    try {
      // Start session via store (creates DB record + sets store state)
      await startSession(user.id, unitPreference);

      // Add each exercise via the store (handles both DB + store state)
      for (const ex of template.exercises) {
        await useWorkoutStore.getState().addExercise({
          id: ex.exerciseId,
          name: ex.exerciseName,
          musclePrimary: [],
        });
        // Pre-fill sets using addSet for each set
        const { exercises: currentExercises } = useWorkoutStore.getState();
        const addedEx = currentExercises.find((e) => e.exerciseId === ex.exerciseId);
        if (addedEx) {
          for (let i = 0; i < ex.defaultSets; i++) {
            useWorkoutStore.getState().addSet(addedEx.sessionExerciseId);
            // Update the set with template defaults
            const updatedEx = useWorkoutStore.getState().exercises.find((e) => e.sessionExerciseId === addedEx.sessionExerciseId);
            const lastSet = updatedEx?.sets[updatedEx.sets.length - 1];
            if (lastSet) {
              useWorkoutStore.getState().updateSet(addedEx.sessionExerciseId, lastSet.id, {
                reps: ex.defaultReps,
                weight: ex.defaultWeight,
                unit: ex.defaultUnit as 'kg' | 'lbs',
              });
            }
          }
        }
      }

      router.push('/workout/active');
    } finally {
      setStarting(false);
    }
  }, [user, unitPreference, startSession]);

  const handleDeleteTemplate = useCallback((template: TemplateCard) => {
    Alert.alert('Delete Template?', `Delete "${template.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const tCol = database.collections.get<WorkoutTemplate>('workout_templates');
          const teCol = database.collections.get<TemplateExercise>('template_exercises');
          await database.write(async () => {
            const tes = await teCol.query(Q.where('template_id', template.id)).fetch();
            for (const te of tes) await te.destroyPermanently();
            const t = await tCol.find(template.id);
            await t.destroyPermanently();
          });
          setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        },
      },
    ]);
  }, []);

  const handleStart = useCallback(async () => {
    if (!user) return;
    setStarting(true);
    await startSession(user.id, unitPreference);
    setStarting(false);
    router.push('/workout/active');
  }, [user, unitPreference, startSession]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing[4],
        paddingHorizontal: spacing[5],
        paddingBottom: insets.bottom + 32,
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[6] }}>
        <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
          Workout
        </Text>
        {syncStatus === 'syncing' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ActivityIndicator size="small" color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Syncing…</Text>
          </View>
        )}
        {syncStatus === 'error' && (
          <Text style={{ color: colors.error, fontSize: fontSize.xs }}>Sync failed</Text>
        )}
      </View>

      {/* Active session banner */}
      {isActive && (
        <Pressable
          onPress={() => router.push('/workout/active')}
          style={[
            styles.activeBanner,
            {
              backgroundColor: colors.text,
              borderRadius: radius.lg,
              padding: spacing[4],
              marginBottom: spacing[5],
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, opacity: 0.7 }}>
              {isPaused ? '⏸ PAUSED' : 'ACTIVE WORKOUT'}
            </Text>
            <Text style={{ color: colors.background, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginTop: 2 }}>
              {formatElapsed(elapsed)}
            </Text>
            <Text style={{ color: colors.background, fontSize: fontSize.sm, opacity: 0.7, marginTop: 2 }}>
              {exercises.length} exercise{exercises.length !== 1 ? 's' : ''}
              {' · '}
              {exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.loggedAt !== null).length, 0)} sets logged
            </Text>
          </View>
          <Text style={{ color: colors.background, fontSize: fontSize.xl }}>›</Text>
        </Pressable>
      )}

      {/* Start workout */}
      {!isActive && (
        <Pressable
          onPress={handleStart}
          disabled={starting}
          style={[
            styles.startBtn,
            {
              backgroundColor: colors.text,
              borderRadius: radius.lg,
              paddingVertical: spacing[5],
              alignItems: 'center',
              marginBottom: spacing[6],
              opacity: starting ? 0.6 : 1,
            },
          ]}
        >
          {starting ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={{ color: colors.background, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
              Start Workout
            </Text>
          )}
        </Pressable>
      )}

      {/* Templates section */}
      <View style={[styles.sectionHeader, { marginBottom: spacing[3] }]}>
        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>Templates</Text>
      </View>

      {loadingTemplates ? (
        <ActivityIndicator color={colors.textMuted} style={{ marginBottom: spacing[4] }} />
      ) : templates.length === 0 ? (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[5], alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
            No templates yet.{'\n'}Finish a workout and save it as a template.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[5] }} contentContainerStyle={{ gap: spacing[3], paddingRight: spacing[1] }}>
          {templates.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => handleStartFromTemplate(t)}
              onLongPress={() => handleDeleteTemplate(t)}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing[4],
                  width: 180,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: 4 }} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[3] }}>
                {t.exerciseCount} exercise{t.exerciseCount !== 1 ? 's' : ''}
              </Text>
              {t.exercises.slice(0, 3).map((ex) => (
                <Text key={ex.exerciseId} style={{ color: colors.textMuted, fontSize: fontSize.xs }} numberOfLines={1}>
                  · {ex.exerciseName}
                </Text>
              ))}
              {t.exercises.length > 3 && (
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>+{t.exercises.length - 3} more</Text>
              )}
              <View style={{ marginTop: spacing[3], backgroundColor: colors.text, borderRadius: radius.md, paddingVertical: spacing[1], alignItems: 'center' }}>
                <Text style={{ color: colors.background, fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>Start</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Recent sessions header + filters */}
      <View style={[styles.sectionHeader, { marginBottom: spacing[3] }]}>
        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
          Recent
        </Text>
        <Pressable onPress={() => router.push('/workout/history')}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>View all</Text>
        </Pressable>
      </View>

      {/* Date filter chips */}
      <View style={[styles.filterRow, { marginBottom: spacing[4] }]}>
        {DATE_FILTERS.map((f) => {
          const active = dateFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setDateFilter(f.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.text : colors.surface,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                },
              ]}
            >
              <Text style={{
                color: active ? colors.background : colors.textMuted,
                fontSize: fontSize.xs,
                fontWeight: active ? fontWeight.semibold : fontWeight.normal,
              }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loadingHistory ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: spacing[6] }} />
      ) : filteredSessions.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base, marginTop: spacing[2] }}>
          {dateFilter === 'all' ? 'No workouts yet. Start your first session above!' : 'No workouts in this period.'}
        </Text>
      ) : (
        filteredSessions.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/workout/session/${s.id}`)}
            style={({ pressed }) => [
              styles.sessionCard,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                padding: spacing[4],
                marginBottom: spacing[3],
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium }}>
                  {formatDate(s.startedAt)}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 }}>
                  {s.exerciseCount} exercise{s.exerciseCount !== 1 ? 's' : ''} · {s.setCount} set{s.setCount !== 1 ? 's' : ''}
                  {' · '}{formatDuration(s.startedAt, s.endedAt)}
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>›</Text>
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  activeBanner: { flexDirection: 'row', alignItems: 'center' },
  startBtn: {},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: {},
  sessionCard: {},
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
});
