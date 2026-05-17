import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, TextInput, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { database } from '@/lib/watermelon/database';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { PersonalRecord, Exercise, WorkoutSession, SessionExercise, Set as SetModel, BodyWeightLog } from '@/lib/watermelon/models';
import { Eyebrow } from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PREntry {
  exerciseId: string;
  exerciseName: string;
  musclePrimary: string[];
  records: { repCount: number; weight: number; unit: string; achievedAt: number }[];
}

interface WeekBar {
  label: string;   // e.g. "Mon 5 May"
  volume: number;
  sessions: number;
}

interface WeightEntry {
  date: string;
  weight: number;
  unit: string;
  loggedAt: number;
}

interface ProgressData {
  prs: PREntry[];
  weekBars: WeekBar[];
  muscleThisWeek: string[];
  totalSessions: number;
  weightEntries: WeightEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REP_LABELS: Record<number, string> = {
  1: '1RM', 2: '2RM', 3: '3RM', 4: '4RM', 5: '5RM',
  6: '6RM', 8: '8RM', 10: '10RM', 12: '12RM', 15: '15RM',
};

function repLabel(reps: number): string {
  return REP_LABELS[reps] ?? `${reps} reps`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Volume Bar ───────────────────────────────────────────────────────────────

function VolumeBar({ bar, maxVol, colors, fontSize, fontWeight, spacing, radius }: {
  bar: WeekBar; maxVol: number; colors: any; fontSize: any; fontWeight: any; spacing: any; radius: any;
}) {
  const pct = maxVol > 0 ? bar.volume / maxVol : 0;
  const BAR_MAX = 80;
  const height = Math.max(pct * BAR_MAX, bar.volume > 0 ? 4 : 0);

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: colors.textMuted, fontSize: 9, marginBottom: 2, textAlign: 'center' }}>
        {bar.volume >= 1000 ? `${(bar.volume / 1000).toFixed(1)}k` : bar.volume > 0 ? String(Math.round(bar.volume)) : ''}
      </Text>
      <View style={{ height: BAR_MAX, justifyContent: 'flex-end' }}>
        <View style={{ height, width: 20, backgroundColor: colors.text, borderRadius: radius.sm, opacity: bar.volume > 0 ? 1 : 0.15 }} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>
        {bar.label}
      </Text>
      {bar.sessions > 0 && (
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success, marginTop: 2 }} />
      )}
    </View>
  );
}

// ─── Load data ────────────────────────────────────────────────────────────────

async function loadProgressData(userId: string): Promise<ProgressData> {
  const prCol = database.collections.get<PersonalRecord>('personal_records');
  const exCol = database.collections.get<Exercise>('exercises');
  const sessionsCol = database.collections.get<WorkoutSession>('workout_sessions');
  const seCol = database.collections.get<SessionExercise>('session_exercises');

  // PRs
  const prs = await prCol.query(Q.where('user_id', userId), Q.where('is_deleted', false)).fetch();
  const prExIds = [...new Set(prs.map((pr) => pr.exerciseId))];
  const prExMap = new Map<string, Exercise>();
  await Promise.all(prExIds.map(async (id) => {
    try { prExMap.set(id, await exCol.find(id)); } catch {}
  }));

  const prMap = new Map<string, PREntry>();
  for (const pr of prs) {
    if (!prMap.has(pr.exerciseId)) {
      const ex = prExMap.get(pr.exerciseId);
      prMap.set(pr.exerciseId, {
        exerciseId: pr.exerciseId,
        exerciseName: ex?.name ?? 'Unknown',
        musclePrimary: ex?.musclePrimary ?? [],
        records: [],
      });
    }
    prMap.get(pr.exerciseId)!.records.push({ repCount: pr.repCount, weight: pr.weight, unit: pr.unit, achievedAt: pr.achievedAt });
  }
  const prEntries = Array.from(prMap.values()).map((e) => ({
    ...e,
    records: [...e.records].sort((a, b) => a.repCount - b.repCount),
  }));
  prEntries.sort((a, b) => {
    const mg = (a.musclePrimary[0] ?? '').localeCompare(b.musclePrimary[0] ?? '');
    return mg !== 0 ? mg : a.exerciseName.localeCompare(b.exerciseName);
  });

  // Last 10 weeks of volume
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  type WeekBucket = WeekBar & { _start: number };
  const weeks: WeekBucket[] = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(thisWeekStart);
    d.setDate(d.getDate() - i * 7);
    return { label: weekLabel(d), volume: 0, sessions: 0, _start: d.getTime() };
  }).reverse();

  const allSessions = await sessionsCol
    .query(
      Q.where('user_id', userId),
      Q.where('is_deleted', false),
      Q.where('ended_at', Q.notEq(null)),
      Q.where('started_at', Q.gte(weeks[0]._start)),
    )
    .fetch();

  // Muscle groups trained this week
  const weekStart = thisWeekStart.getTime();
  const thisWeekSessions = allSessions.filter((s) => s.startedAt >= weekStart);
  const muscleSet = new Set<string>();

  if (allSessions.length > 0) {
    const setsCol = database.collections.get<SetModel>('sets');
    const allSessionIds = allSessions.map((s) => s.id);

    const allSEs = await seCol
      .query(Q.where('session_id', Q.oneOf(allSessionIds)), Q.where('is_deleted', false))
      .fetch();

    const seIds = allSEs.map((se) => se.id);
    const allSets = seIds.length > 0
      ? await setsCol.query(Q.where('session_exercise_id', Q.oneOf(seIds))).fetch()
      : [];

    const weekSessionIds = new Set(allSessions.filter((s) => s.startedAt >= weekStart).map((s) => s.id));
    const weekExIds = [...new Set(allSEs.filter((se) => weekSessionIds.has(se.sessionId)).map((se) => se.exerciseId))];
    const weekExMap = new Map<string, Exercise>();
    await Promise.all(weekExIds.map(async (id) => {
      try { weekExMap.set(id, await exCol.find(id)); } catch {}
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

    for (const session of allSessions) {
      let bucket: WeekBucket | undefined;
      for (let i = weeks.length - 1; i >= 0; i--) {
        if (session.startedAt >= weeks[i]._start) { bucket = weeks[i]; break; }
      }
      if (!bucket) continue;

      const ses = seBySession.get(session.id) ?? [];
      let sessionVol = 0;
      for (const se of ses) {
        const sets = setsBySE.get(se.id) ?? [];
        sessionVol += sets.filter((s) => !s.isDeleted).reduce((acc, s) => acc + s.reps * s.weight, 0);
        if (session.startedAt >= weekStart) {
          const ex = weekExMap.get(se.exerciseId);
          if (ex) ex.musclePrimary.forEach((m) => muscleSet.add(m));
        }
      }
      bucket.volume += sessionVol;
      bucket.sessions += 1;
    }
  }

  // Body weight
  const bwCol = database.collections.get<BodyWeightLog>('body_weight_logs');
  const bwRaw = await bwCol
    .query(Q.where('user_id', userId), Q.where('is_deleted', false), Q.sortBy('logged_at', Q.desc))
    .fetch();
  const weightEntries: WeightEntry[] = bwRaw.slice(0, 14).reverse().map((w) => ({
    date: w.date, weight: w.weight, unit: w.unit, loggedAt: w.loggedAt,
  }));

  return {
    prs: prEntries,
    weekBars: weeks.map(({ label, volume, sessions }) => ({ label, volume, sessions })),
    muscleThisWeek: Array.from(muscleSet).filter((m) => m !== 'cardio'),
    totalSessions: allSessions.length,
    weightEntries,
  };
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [weightInput, setWeightInput] = useState('');
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [savingWeight, setSavingWeight] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const d = await loadProgressData(user.id);
      setData(d);
      setExpanded(new Set(d.prs.slice(0, 3).map((e) => e.exerciseId)));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLogWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || !user) return;
    setSavingWeight(true);
    try {
      const bwCol = database.collections.get<BodyWeightLog>('body_weight_logs');
      const today = toISODate(new Date());
      await database.write(async () => {
        await bwCol.create((r) => {
          r.userId = user.id;
          r.weight = w;
          r.unit = 'kg';
          r.loggedAt = Date.now();
          r.date = today;
          r.notes = null;
          r.isDeleted = false;
          r.remoteId = null;
          r.syncedAt = null;
        });
      });
      setLoggingWeight(false);
      setWeightInput('');
      await load();
    } finally {
      setSavingWeight(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing[5], paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[5] }}>
        Progress
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: spacing[10] }} />
      ) : !data ? null : (
        <>
          {/* Volume chart */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }]}>
            <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: spacing[1] }}>
              Weekly Volume
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[4] }}>
              Total kg lifted per week · last 10 weeks
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              {(() => {
                const maxVol = Math.max(...data.weekBars.map((b) => b.volume), 1);
                return data.weekBars.map((bar, i) => (
                  <VolumeBar key={i} bar={bar} maxVol={maxVol} colors={colors} fontSize={fontSize} fontWeight={fontWeight} spacing={spacing} radius={radius} />
                ));
              })()}
            </View>
          </View>

          {/* Muscles trained this week */}
          {data.muscleThisWeek.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }]}>
              <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: spacing[3] }}>
                Trained This Week
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
                {data.muscleThisWeek.map((m) => (
                  <View key={m} style={{ backgroundColor: colors.background, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.xs, fontWeight: fontWeight.medium }}>
                      {MUSCLE_GROUP_LABELS[m] ?? m}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Body weight */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                  Body Weight
                </Text>
                {data.weightEntries.length > 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                    {data.weightEntries[data.weightEntries.length - 1].weight} {data.weightEntries[data.weightEntries.length - 1].unit} · {formatDate(data.weightEntries[data.weightEntries.length - 1].loggedAt)}
                  </Text>
                )}
              </View>
              {loggingWeight ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                  <TextInput
                    value={weightInput}
                    onChangeText={setWeightInput}
                    placeholder="kg"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    autoFocus
                    style={{ color: colors.text, fontSize: fontSize.base, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], width: 72, textAlign: 'center' }}
                  />
                  {savingWeight ? (
                    <ActivityIndicator size="small" color={colors.text} />
                  ) : (
                    <>
                      <Pressable onPress={() => setLoggingWeight(false)} hitSlop={8}>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={handleLogWeight} hitSlop={8} style={{ marginLeft: spacing[3] }}>
                        <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Save</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              ) : (
                <Pressable
                  onPress={() => setLoggingWeight(true)}
                  style={{ backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
                >
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>+ Log</Text>
                </Pressable>
              )}
            </View>

            {data.weightEntries.length > 1 && (() => {
              const weights = data.weightEntries.map((e) => e.weight);
              const minW = Math.min(...weights);
              const maxW = Math.max(...weights);
              const range = maxW - minW || 1;
              const BAR_MAX = 48;
              return (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
                  {data.weightEntries.map((e, i) => {
                    const h = Math.max(((e.weight - minW) / range) * BAR_MAX, 4);
                    const isLast = i === data.weightEntries.length - 1;
                    return (
                      <View key={e.loggedAt} style={{ flex: 1, alignItems: 'center' }}>
                        <View style={{ height: BAR_MAX, justifyContent: 'flex-end' }}>
                          <View style={{ height: h, width: 12, backgroundColor: isLast ? colors.text : colors.textMuted, borderRadius: 2, opacity: isLast ? 1 : 0.5 }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {data.weightEntries.length === 0 && (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing[2] }}>
                Log your first weigh-in to start tracking
              </Text>
            )}
          </View>

          {/* PRs section */}
          {data.prs.length === 0 ? (
            <View style={{ marginTop: spacing[4], alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
                No PRs yet.{'\n'}Log your first workout to start tracking bests.
              </Text>
            </View>
          ) : (
            <>
              {/* PR summary strip */}
              <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }]}>
                <View style={styles.summaryItem}>
                  <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>{data.prs.length}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>exercises</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
                    {data.prs.reduce((acc, e) => acc + e.records.length, 0)}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>total PRs</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.summaryItem}>
                  <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
                    {data.prs.filter((e) => e.records.some((r) => r.repCount === 1)).length}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>1RM tracked</Text>
                </View>
              </View>

              <Eyebrow style={{ marginBottom: spacing[3] }}>Personal Records</Eyebrow>

              {data.prs.map((entry) => {
                const isOpen = expanded.has(entry.exerciseId);
                const best = entry.records.find((r) => r.repCount === 1) ?? entry.records[0];
                return (
                  <Pressable
                    key={entry.exerciseId}
                    onPress={() => toggleExpand(entry.exerciseId)}
                    style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: spacing[3], overflow: 'hidden' }]}
                  >
                    <View style={[styles.cardHeader, { padding: spacing[4] }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>{entry.exerciseName}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                          {entry.musclePrimary.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
                        </Text>
                      </View>
                      {best && (
                        <View style={{ alignItems: 'flex-end', marginRight: spacing[3] }}>
                          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
                            {best.weight}<Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.normal }}> {best.unit}</Text>
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{repLabel(best.repCount)}</Text>
                        </View>
                      )}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          const lines = entry.records.map((r) => `  ${repLabel(r.repCount)}: ${r.weight} ${r.unit}`).join('\n');
                          Share.share({ message: `💪 Personal Records on Pumped!\n\n${entry.exerciseName}\n${lines}\n\nhttps://pumpedapp.io` });
                        }}
                        hitSlop={12}
                        style={{ paddingHorizontal: 6 }}
                      >
                        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>⬆</Text>
                      </Pressable>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>{isOpen ? '∧' : '∨'}</Text>
                    </View>

                    {isOpen && (
                      <View style={{ paddingHorizontal: spacing[4], paddingBottom: spacing[4] }}>
                        <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing[3] }} />
                        {entry.records.map((r) => (
                          <View key={r.repCount} style={[styles.recordRow, { paddingVertical: spacing[2] }]}>
                            <View style={[styles.repBadge, { backgroundColor: colors.border, borderRadius: radius.sm }]}>
                              <Text style={{ color: colors.text, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, paddingHorizontal: 6, paddingVertical: 2 }}>
                                {repLabel(r.repCount)}
                              </Text>
                            </View>
                            <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold, marginLeft: spacing[3] }}>
                              {r.weight} {r.unit}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 'auto' }}>
                              {formatDate(r.achievedAt)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 32 },
  card: {},
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  repBadge: {},
});
