import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { database } from '@/lib/watermelon/database';
import type { WorkoutSession, SessionExercise } from '@/lib/watermelon/models';

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
  const { user } = useAuthStore();
  const { isActive, isPaused, getElapsed, exercises, startSession } = useWorkoutStore();

  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [starting, setStarting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer for active session banner
  useEffect(() => {
    if (!isActive) { setElapsed(0); return; }
    if (isPaused) { setElapsed(getElapsed()); return; }
    const tick = () => setElapsed(getElapsed());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isActive, isPaused, getElapsed]);

  // Load recent sessions
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
          Q.take(5),
        )
        .fetch();

      const rows = await Promise.all(
        raw.map(async (s) => {
          const ses = await seCollection.query(Q.where('session_id', s.id), Q.where('is_deleted', false)).fetch();
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

      setRecentSessions(rows);
      setLoadingHistory(false);
    };
    load();
  }, [user, isActive]);  // re-fetch when session finishes

  const handleStart = useCallback(async () => {
    if (!user) return;
    setStarting(true);
    await startSession(user.id);
    setStarting(false);
    router.push('/workout/active');
  }, [user, startSession]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing[4],
        paddingHorizontal: spacing[5],
        paddingBottom: insets.bottom + 32,
      }}
    >
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[6] }}>
        Workout
      </Text>

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

      {/* Recent sessions */}
      <View style={styles.sectionHeader}>
        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
          Recent
        </Text>
        <Pressable onPress={() => router.push('/workout/history')}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>View all</Text>
        </Pressable>
      </View>

      {loadingHistory ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: spacing[6] }} />
      ) : recentSessions.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.base, marginTop: spacing[4] }}>
          No workouts yet. Start your first session above!
        </Text>
      ) : (
        recentSessions.map((s) => (
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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sessionCard: {},
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
});
