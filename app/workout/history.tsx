import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { database } from '@/lib/watermelon/database';
import type { WorkoutSession, SessionExercise, Set as SetModel } from '@/lib/watermelon/models';

type DateFilter = 'all' | 'week' | 'month' | '3months';

interface SessionRow {
  id: string;
  startedAt: number;
  endedAt: number | null;
  exerciseCount: number;
  setCount: number;
  primaryExercises: string[];
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
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: diff > 300 ? 'numeric' : undefined });
}

function formatDuration(startMs: number, endMs: number): string {
  const m = Math.round((endMs - startMs) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

async function loadSessions(userId: string): Promise<SessionRow[]> {
  const sessionsCollection = database.collections.get<WorkoutSession>('workout_sessions');
  const seCollection = database.collections.get<SessionExercise>('session_exercises');

  const raw = await sessionsCollection
    .query(
      Q.where('user_id', userId),
      Q.where('is_deleted', false),
      Q.where('ended_at', Q.notEq(null)),
      Q.sortBy('started_at', Q.desc),
    )
    .fetch();

  return Promise.all(
    raw.map(async (session) => {
      const ses = await seCollection
        .query(Q.where('session_id', session.id), Q.where('is_deleted', false))
        .fetch();

      let totalSets = 0;
      for (const se of ses) {
        const sets = await se.sets.fetch() as SetModel[];
        totalSets += sets.filter((s) => !s.isDeleted).length;
      }

      return {
        id: session.id,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        exerciseCount: ses.length,
        setCount: totalSets,
        primaryExercises: [],
      };
    }),
  );
}

async function deleteSession(sessionId: string): Promise<void> {
  const sessionsCollection = database.collections.get<WorkoutSession>('workout_sessions');
  const seCollection = database.collections.get<SessionExercise>('session_exercises');

  await database.write(async () => {
    const ses = await seCollection.query(Q.where('session_id', sessionId)).fetch();
    for (const se of ses) {
      const sets = await se.sets.fetch() as SetModel[];
      for (const s of sets) await s.destroyPermanently();
      await se.destroyPermanently();
    }
    const session = await sessionsCollection.find(sessionId);
    await session.destroyPermanently();
  });
}

export default function WorkoutHistoryScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [allSessions, setAllSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const rows = await loadSessions(user.id);
    setAllSessions(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = allSessions.filter((s) => {
    const cutoff = getFilterCutoff(dateFilter);
    return s.startedAt >= cutoff;
  });

  const handleDelete = useCallback((id: string, date: string) => {
    Alert.alert(
      'Delete Workout?',
      `Delete the session from ${date}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSession(id);
            setAllSessions((prev) => prev.filter((s) => s.id !== id));
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
      <View style={[styles.filterRow, { paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border }]}>
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
          renderItem={({ item }) => {
            const dateStr = formatDate(item.startedAt);
            return (
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
                      {dateStr}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 }}>
                      {item.exerciseCount} exercise{item.exerciseCount !== 1 ? 's' : ''} · {item.setCount} set{item.setCount !== 1 ? 's' : ''}
                      {item.endedAt ? ` · ${formatDuration(item.startedAt, item.endedAt)}` : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDelete(item.id, dateStr)}
                    hitSlop={12}
                    style={{ marginRight: spacing[3] }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>🗑</Text>
                  </Pressable>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>›</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={[styles.center, { marginTop: spacing[16] }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
                {dateFilter === 'all' ? 'No workouts yet.\nStart your first session!' : 'No workouts in this period.'}
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
  filterRow: { flexDirection: 'row', gap: 8 },
  chip: {},
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sessionCard: {},
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
});
