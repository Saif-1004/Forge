import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { database } from '@/lib/watermelon/database';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { WorkoutSession, SessionExercise, Set as SetModel, Exercise } from '@/lib/watermelon/models';

type DateFilter = 'all' | 'week' | 'month' | '3months';

interface SessionRow {
  id: string;
  startedAt: number;
  endedAt: number | null;
  exerciseCount: number;
  setCount: number;
  muscleGroups: string[];
}

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '3months', label: '3 Months' },
];

function getFilterCutoff(filter: DateFilter): number {
  const now = Date.now();
  if (filter === 'week') return now - 7 * 86400000;
  if (filter === 'month') return now - 30 * 86400000;
  if (filter === '3months') return now - 90 * 86400000;
  return 0;
}

function formatDate(ms: number): string {
  const now = new Date();
  const d = new Date(ms);
  const diff = Math.floor((now.getTime() - ms) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: diff > 300 ? 'numeric' : undefined,
  });
}

function formatDuration(startMs: number, endMs: number): string {
  const m = Math.round((endMs - startMs) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

async function loadSessions(userId: string): Promise<SessionRow[]> {
  const sessionsCol = database.collections.get<WorkoutSession>('workout_sessions');
  const seCol = database.collections.get<SessionExercise>('session_exercises');
  const exCol = database.collections.get<Exercise>('exercises');
  const setsCol = database.collections.get<SetModel>('sets');

  const raw = await sessionsCol
    .query(
      Q.where('user_id', userId),
      Q.where('is_deleted', false),
      Q.where('ended_at', Q.notEq(null)),
      Q.sortBy('started_at', Q.desc),
    )
    .fetch();

  if (raw.length === 0) return [];

  const sessionIds = raw.map((s) => s.id);
  const allSEs = await seCol
    .query(Q.where('session_id', Q.oneOf(sessionIds)), Q.where('is_deleted', false))
    .fetch();

  const seIds = allSEs.map((se) => se.id);
  const allSets = seIds.length > 0
    ? await setsCol.query(Q.where('session_exercise_id', Q.oneOf(seIds))).fetch()
    : [];

  const exerciseIds = [...new Set(allSEs.map((se) => se.exerciseId))];
  const exerciseMap = new Map<string, Exercise>();
  await Promise.all(exerciseIds.map(async (id) => {
    try { exerciseMap.set(id, await exCol.find(id)); } catch {}
  }));

  const setsBySE = new Map<string, SetModel[]>();
  for (const set of allSets) {
    const bucket = setsBySE.get(set.sessionExerciseId) ?? [];
    bucket.push(set);
    setsBySE.set(set.sessionExerciseId, bucket);
  }

  const seBySession = new Map<string, SessionExercise[]>();
  for (const se of allSEs) {
    const bucket = seBySession.get(se.sessionId) ?? [];
    bucket.push(se);
    seBySession.set(se.sessionId, bucket);
  }

  return raw.map((session) => {
    const ses = seBySession.get(session.id) ?? [];
    let totalSets = 0;
    const muscleSet = new Set<string>();

    for (const se of ses) {
      const sets = setsBySE.get(se.id) ?? [];
      totalSets += sets.filter((s) => !s.isDeleted).length;
      const ex = exerciseMap.get(se.exerciseId);
      if (ex) ex.musclePrimary.forEach((m) => muscleSet.add(m));
    }

    return {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      exerciseCount: ses.length,
      setCount: totalSets,
      muscleGroups: Array.from(muscleSet),
    };
  });
}

async function deleteSession(sessionId: string): Promise<void> {
  const sessionsCol = database.collections.get<WorkoutSession>('workout_sessions');
  const seCol = database.collections.get<SessionExercise>('session_exercises');

  await database.write(async () => {
    const ses = await seCol.query(Q.where('session_id', sessionId)).fetch();
    for (const se of ses) {
      const sets = await se.sets.fetch() as SetModel[];
      for (const s of sets) await s.destroyPermanently();
      await se.destroyPermanently();
    }
    const session = await sessionsCol.find(sessionId);
    await session.destroyPermanently();
  });
}

function DeleteAction({ onPress, dragX }: { onPress: () => void; dragX: Animated.AnimatedInterpolation<number> }) {
  const { colors, spacing, fontSize, fontWeight } = useTheme();
  const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.8], extrapolate: 'clamp' });

  return (
    <Pressable
      onPress={onPress}
      style={[styles.deleteAction, { backgroundColor: colors.error, paddingHorizontal: spacing[5] }]}
    >
      <Animated.Text style={{ color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.semibold, transform: [{ scale }] }}>
        Delete
      </Animated.Text>
    </Pressable>
  );
}

export default function WorkoutHistoryScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const [allSessions, setAllSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const rows = await loadSessions(user.id);
    setAllSessions(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const availableMuscles = Array.from(
    new Set(allSessions.flatMap((s) => s.muscleGroups)),
  ).sort();

  const filtered = allSessions.filter((s) => {
    const cutoff = getFilterCutoff(dateFilter);
    if (s.startedAt < cutoff) return false;
    if (muscleFilter && !s.muscleGroups.includes(muscleFilter)) return false;
    return true;
  });

  const confirmDelete = useCallback((item: SessionRow) => {
    const ref = swipeableRefs.current.get(item.id);
    Alert.alert(
      'Delete Workout?',
      `Delete the session from ${formatDate(item.startedAt)}? This cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => ref?.close(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(item.id);
            setAllSessions((prev) => prev.filter((s) => s.id !== item.id));
          },
        },
      ],
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
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
          Workout History
        </Text>
      </View>

      {/* Date filter chips */}
      <View style={[styles.filterRow, { paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2] }]}>
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
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[2],
                },
              ]}
            >
              <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Muscle group filter chips */}
      {availableMuscles.length > 0 && (
        <View style={[styles.filterRow, { paddingHorizontal: spacing[5], paddingBottom: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' }]}>
          <Pressable
            onPress={() => setMuscleFilter(null)}
            style={[styles.chip, { backgroundColor: muscleFilter === null ? colors.text : colors.surface, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }]}
          >
            <Text style={{ color: muscleFilter === null ? colors.background : colors.textMuted, fontSize: fontSize.xs }}>All muscles</Text>
          </Pressable>
          {availableMuscles.map((m) => {
            const active = muscleFilter === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMuscleFilter(active ? null : m)}
                style={[styles.chip, { backgroundColor: active ? colors.text : colors.surface, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }]}
              >
                <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.xs }}>
                  {MUSCLE_GROUP_LABELS[m] ?? m}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[4],
            paddingBottom: insets.bottom + 24,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
          renderItem={({ item }) => (
            <Swipeable
              ref={(ref) => { swipeableRefs.current.set(item.id, ref); }}
              friction={2}
              rightThreshold={40}
              renderRightActions={(_, dragX) => (
                <DeleteAction onPress={() => confirmDelete(item)} dragX={dragX} />
              )}
            >
              <Pressable
                onPress={() => router.push(`/workout/session/${item.id}`)}
                style={({ pressed }) => [
                  styles.sessionCard,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    padding: spacing[4],
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={styles.sessionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                      {formatDate(item.startedAt)}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 }}>
                      {item.exerciseCount} exercise{item.exerciseCount !== 1 ? 's' : ''} · {item.setCount} set{item.setCount !== 1 ? 's' : ''}
                      {item.endedAt ? ` · ${formatDuration(item.startedAt, item.endedAt)}` : ''}
                    </Text>
                    {item.muscleGroups.length > 0 && (
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 3 }}>
                        {item.muscleGroups.slice(0, 4).map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
                        {item.muscleGroups.length > 4 ? ' …' : ''}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>›</Text>
                </View>
              </Pressable>
            </Swipeable>
          )}
          ListEmptyComponent={
            <View style={[styles.center, { marginTop: spacing[16] }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
                {dateFilter === 'all' && !muscleFilter
                  ? 'No workouts yet.\nStart your first session!'
                  : 'No workouts match these filters.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {},
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sessionCard: {},
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  deleteAction: { justifyContent: 'center', alignItems: 'center', marginBottom: 0 },
});
