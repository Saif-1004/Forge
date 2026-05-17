import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Image, ScrollView, Pressable, ActivityIndicator, StyleSheet, Share } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { database } from '@/lib/watermelon/database';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import { getOverloadSuggestions, type OverloadSuggestion } from '@/lib/pr/progressiveOverload';
import type { WorkoutSession, SessionExercise, Exercise, Set as SetModel, FoodLog } from '@/lib/watermelon/models';

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDuration(startMs: number, endMs: number): string {
  const m = Math.round((endMs - startMs) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function weekDates(): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const isoOffset = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - isoOffset);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
  );
}

interface LastWorkout {
  id: string;
  startedAt: number;
  endedAt: number | null;
  muscleGroups: string[];
  totalSets: number;
}

interface HomeData {
  sessionsThisWeek: number;
  streak: number;
  totalSessions: number;
  totalVolume: number;
  workoutDates: Set<string>;
  lastWorkout: LastWorkout | null;
}

export default function HomeTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, displayName } = useAuthStore();

  const { calorieGoal, proteinGoal, carbsGoal, fatGoal } = useSettingsStore();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nutritionToday, setNutritionToday] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [overloadSuggestions, setOverloadSuggestions] = useState<OverloadSuggestion[]>([]);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toISODate(today), [today]);
  const days = useMemo(() => weekDates(), []);
  const DAYS_LABEL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const sessionsCol = database.collections.get<WorkoutSession>('workout_sessions');
      const allSessions = await sessionsCol
        .query(
          Q.where('user_id', user.id),
          Q.where('is_deleted', false),
          Q.where('ended_at', Q.notEq(null)),
          Q.sortBy('started_at', Q.desc),
        )
        .fetch();

      const weekStart = new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate()).getTime();
      const thisWeekSessions = allSessions.filter((s) => s.startedAt >= weekStart);
      const workoutDates = new Set(allSessions.map((s) => toISODate(new Date(s.startedAt))));

      let streak = 0;
      let checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      if (!workoutDates.has(todayStr)) {
        checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() - 1);
      }
      while (workoutDates.has(toISODate(checkDate))) {
        streak++;
        checkDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() - 1);
      }

      // Last workout details + lifetime volume
      let lastWorkout: LastWorkout | null = null;
      let totalVolume = 0;
      const seCol = database.collections.get<SessionExercise>('session_exercises');
      const exCol = database.collections.get<Exercise>('exercises');

      if (allSessions.length > 0) {
        const s = allSessions[0];
        const setsCol = database.collections.get<SetModel>('sets');
        const ses = await seCol
          .query(Q.where('session_id', s.id), Q.where('is_deleted', false))
          .fetch();

        const seIds = ses.map((se) => se.id);
        const exIds = [...new Set(ses.map((se) => se.exerciseId))];
        const lastExMap = new Map<string, Exercise>();
        await Promise.all(exIds.map(async (id) => {
          try { lastExMap.set(id, await exCol.find(id)); } catch {}
        }));
        const allSets = seIds.length > 0
          ? await setsCol.query(Q.where('session_exercise_id', Q.oneOf(seIds))).fetch()
          : [];
        const setsBySE = new Map<string, SetModel[]>();
        for (const set of allSets) {
          const bucket = setsBySE.get(set.sessionExerciseId) ?? [];
          bucket.push(set);
          setsBySE.set(set.sessionExerciseId, bucket);
        }

        const muscles: string[] = [];
        let totalSets = 0;
        for (const se of ses) {
          const ex = lastExMap.get(se.exerciseId);
          if (ex?.musclePrimary[0] && !muscles.includes(ex.musclePrimary[0])) {
            muscles.push(ex.musclePrimary[0]);
          }
          const active = (setsBySE.get(se.id) ?? []).filter((st) => !st.isDeleted);
          totalSets += active.length;
          totalVolume += active.reduce((acc, st) => acc + st.reps * st.weight, 0);
        }
        lastWorkout = { id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, muscleGroups: muscles, totalSets };
      }

      setData({ sessionsThisWeek: thisWeekSessions.length, streak, totalSessions: allSessions.length, totalVolume, workoutDates, lastWorkout });
    } finally {
      setLoading(false);
    }
  }, [user, days, todayStr]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    getOverloadSuggestions(user.id).then(setOverloadSuggestions).catch(() => {});
  }, [user]));

  useFocusEffect(useCallback(() => {
    if (!user) return;
    const dateStr = todayStr;
    const logsCol = database.collections.get<FoodLog>('food_logs');
    logsCol
      .query(Q.where('user_id', user.id), Q.where('date', dateStr), Q.where('is_deleted', false))
      .fetch()
      .then((logs) => {
        const totals = logs.reduce(
          (acc, l) => ({ calories: acc.calories + l.caloriesKcal, protein: acc.protein + l.proteinG, carbs: acc.carbs + l.carbsG, fat: acc.fat + l.fatG }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 },
        );
        setNutritionToday(totals);
      })
      .catch(() => {});
  }, [user, todayStr]));

  const name = displayName ?? user?.email?.split('@')[0] ?? '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing[5], paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header: greeting + logo */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: 2 }}>
            {greeting()}
          </Text>
          <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
            {name || 'Welcome'}
          </Text>
        </View>
        <Image
          source={require('@/assets/pumped_logo_transparent.png')}
          style={[styles.logo, { tintColor: colors.text }]}
          resizeMode="contain"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: spacing[10] }} />
      ) : (
        <>
          {/* Week strip */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginTop: spacing[5], marginBottom: spacing[4] }]}>
            <View style={styles.cardHeader}>
              <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                This Week
              </Text>
              <Pressable onPress={() => router.push('/calendar')} hitSlop={8}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Calendar →</Text>
              </Pressable>
            </View>
            <View style={[styles.weekRow, { marginTop: spacing[3] }]}>
              {days.map((d, i) => {
                const ds = toISODate(d);
                const isToday = ds === todayStr;
                const hasWorkout = data?.workoutDates.has(ds) ?? false;
                const isPast = ds <= todayStr;
                return (
                  <View key={i} style={styles.dayCol}>
                    <Text style={{ color: isToday ? colors.text : colors.textMuted, fontSize: fontSize.xs, fontWeight: isToday ? fontWeight.semibold : fontWeight.normal, marginBottom: 6 }}>
                      {DAYS_LABEL[i]}
                    </Text>
                    <View
                      style={[
                        styles.dayDot,
                        {
                          backgroundColor: isToday
                            ? colors.text
                            : hasWorkout
                            ? colors.success
                            : isPast
                            ? colors.border
                            : 'transparent',
                          borderWidth: isPast || isToday ? 0 : 1,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          {/* Stats row: this week + streak */}
          <View style={[styles.statsRow, { marginBottom: spacing[4] }]}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4] }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 }}>THIS WEEK</Text>
              <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
                {data?.sessionsThisWeek ?? 0}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                session{data?.sessionsThisWeek !== 1 ? 's' : ''}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                const s = data?.streak ?? 0;
                if (s > 0) Share.share({ message: `🔥 ${s}-day workout streak on Pumped! Consistency is everything.\n\nhttps://pumpedapp.io` });
              }}
              style={[styles.statCard, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4] }]}
            >
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 }}>STREAK</Text>
              <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
                {data?.streak ?? 0}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                day{data?.streak !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>

          {/* Last workout */}
          {data?.lastWorkout ? (
            <Pressable
              onPress={() => router.push(`/workout/session/${data.lastWorkout!.id}`)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4], opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[2] }}>
                LAST WORKOUT
              </Text>
              <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: 4 }}>
                {new Date(data.lastWorkout.startedAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </Text>
              {data.lastWorkout.muscleGroups.length > 0 && (
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: 4 }}>
                  {data.lastWorkout.muscleGroups.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
                </Text>
              )}
              <View style={styles.lastWorkoutMeta}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                  {data.lastWorkout.totalSets} set{data.lastWorkout.totalSets !== 1 ? 's' : ''}
                </Text>
                {data.lastWorkout.endedAt && (
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                    {formatDuration(data.lastWorkout.startedAt, data.lastWorkout.endedAt)}
                  </Text>
                )}
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>View →</Text>
              </View>
            </Pressable>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[5], marginBottom: spacing[4] }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
                No workouts yet — head to the Workout tab to get started.
              </Text>
            </View>
          )}

          {/* Progressive overload suggestions */}
          {overloadSuggestions.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
                <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, flex: 1 }}>Ready to Progress</Text>
                <Text style={{ fontSize: 16 }}>📈</Text>
              </View>
              {overloadSuggestions.map((s) => (
                <View key={s.exerciseId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>{s.exerciseName}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>
                      Hit {s.reps}+ reps for {s.sessionsHit} sessions at {s.currentWeight}{s.unit}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>
                      → {s.suggestedWeight}{s.unit}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>try this weight</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Today's nutrition */}
          {nutritionToday !== null && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[2] }}>TODAY&apos;S NUTRITION</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing[2] }}>
                <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold, flex: 1 }}>
                  {Math.round(nutritionToday.calories)} kcal
                </Text>
                {calorieGoal > 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: 2 }}>/ {calorieGoal}</Text>
                )}
              </View>
              {calorieGoal > 0 && (
                <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2, marginBottom: spacing[3] }}>
                  <View style={{ height: 3, width: `${Math.min(nutritionToday.calories / calorieGoal, 1) * 100}%`, backgroundColor: colors.text, borderRadius: 2 }} />
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: spacing[5] }}>
                {[
                  { label: 'P', value: nutritionToday.protein, goal: proteinGoal, color: '#3B82F6' },
                  { label: 'C', value: nutritionToday.carbs, goal: carbsGoal, color: '#F59E0B' },
                  { label: 'F', value: nutritionToday.fat, goal: fatGoal, color: '#EF4444' },
                ].map(({ label, value, goal, color }) => (
                  <View key={label} style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                      {Math.round(value)}<Text style={{ color: colors.textMuted, fontWeight: '400' }}>g</Text>
                    </Text>
                    <View style={{ height: 3, width: '100%', backgroundColor: colors.border, borderRadius: 2, marginTop: 4 }}>
                      <View style={{ height: 3, width: `${goal > 0 ? Math.min(value / goal, 1) * 100 : 0}%`, backgroundColor: color, borderRadius: 2 }} />
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 2 }}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Lifetime stats */}
          {(data?.totalSessions ?? 0) > 0 && (
            <View style={[styles.statsRow, { marginBottom: spacing[4] }]}>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4] }]}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 }}>ALL TIME</Text>
                <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
                  {data?.totalSessions ?? 0}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>workouts</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4] }]}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 }}>TOTAL VOLUME</Text>
                <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
                  {data && data.totalVolume >= 1000
                    ? `${(data.totalVolume / 1000).toFixed(1)}k`
                    : (data?.totalVolume ?? 0).toLocaleString()}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>kg lifted</Text>
              </View>
            </View>
          )}

          {/* AI Coach card */}
          <Pressable
            onPress={() => router.push('/coach')}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4], opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center' },
            ]}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginRight: spacing[4] }}>
              <Text style={{ fontSize: 22 }}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: 2 }}>
                <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>AI Coach</Text>
                <View style={{ backgroundColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing[2], paddingVertical: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 9, fontWeight: '600', letterSpacing: 0.5 }}>PRO</Text>
                </View>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                Ask about training, nutrition, or get a program
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>→</Text>
          </Pressable>

          {/* Leaderboard card */}
          <LeaderboardCard
            colors={colors}
            fontSize={fontSize}
            fontWeight={fontWeight}
            spacing={spacing}
            radius={radius}
            userName={displayName ?? user?.email?.split('@')[0] ?? 'You'}
            sessionsThisWeek={data?.sessionsThisWeek ?? 0}
          />
        </>
      )}
    </ScrollView>
  );
}

function LeaderboardCard({ colors, fontSize, fontWeight, spacing, radius, userName, sessionsThisWeek }: {
  colors: any; fontSize: any; fontWeight: any; spacing: any; radius: any;
  userName: string; sessionsThisWeek: number;
}) {
  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[2] }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] }}>
        <View>
          <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
            Weekly Leaderboard
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
            Sessions this week · Friends only
          </Text>
        </View>
        <View style={{ backgroundColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.medium }}>
            COMING SOON
          </Text>
        </View>
      </View>

      {/* Current user row — always shown with real data */}
      <View style={[lbStyles.row, { backgroundColor: colors.background, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[3], marginBottom: spacing[2] }]}>
        <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold, width: 24, textAlign: 'center' }}>
          —
        </Text>
        <View style={[lbStyles.avatar, { backgroundColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
            {userName.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium, flex: 1 }}>
          {userName} (you)
        </Text>
        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
          {sessionsThisWeek}
        </Text>
      </View>

      {/* Placeholder friend slots */}
      {[0, 1].map((i) => (
        <View key={i} style={[lbStyles.row, { paddingHorizontal: spacing[3], paddingVertical: spacing[3], marginBottom: i === 0 ? spacing[2] : 0 }]}>
          <Text style={{ color: colors.border, fontSize: fontSize.sm, width: 24, textAlign: 'center' }}>
            {MEDAL[i] ?? `${i + 1}`}
          </Text>
          <View style={[lbStyles.avatar, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.border, fontSize: fontSize.sm, flex: 1 }}>
            ·  ·  ·
          </Text>
          <Text style={{ color: colors.border, fontSize: fontSize.sm }}>–</Text>
        </View>
      ))}

      {/* Invite CTA */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing[2], paddingTop: spacing[3] }}>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' }}>
          Invite friends to compete on the leaderboard
        </Text>
      </View>
    </View>
  );
}

const lbStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 52, height: 52 },
  card: {},
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center' },
  dayDot: { width: 28, height: 28, borderRadius: 14 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1 },
  lastWorkoutMeta: { flexDirection: 'row', gap: 16, marginTop: 4 },
});
