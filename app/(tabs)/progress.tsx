import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, TextInput, Share, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import Svg, { Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
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
  dailySessions: Record<string, number>;
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

// ─── Body Weight Card ─────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;

function BodyWeightCard({ entries, userId, onSaved, colors, fontSize, fontWeight, spacing, radius }: {
  entries: WeightEntry[];
  userId: string;
  onSaved: () => void;
  colors: any; fontSize: any; fontWeight: any; spacing: any; radius: any;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [logging, setLogging] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const latest = entries[entries.length - 1];
  const first = entries[0];
  const diff = latest && first && entries.length > 1 ? +(latest.weight - first.weight).toFixed(1) : null;

  // chart dimensions
  const CARD_PAD = spacing[4] * 2;
  const CHART_W = SCREEN_W - spacing[5] * 2 - CARD_PAD;
  const CHART_H = 130;
  const PX = 6;
  const PY = 12;

  const weights = entries.map((e) => e.weight);
  const minW = entries.length ? Math.min(...weights) : 0;
  const maxW = entries.length ? Math.max(...weights) : 0;
  const range = maxW - minW || 0.5;

  const pts = entries.map((e, i) => ({
    x: entries.length === 1 ? CHART_W / 2 : PX + (i / (entries.length - 1)) * (CHART_W - PX * 2),
    y: PY + (1 - (e.weight - minW) / range) * (CHART_H - PY * 2),
    ...e,
  }));

  const linePath = pts.length > 1
    ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    : '';
  const areaPath = pts.length > 1
    ? `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${CHART_H} L${pts[0].x.toFixed(1)},${CHART_H} Z`
    : '';

  const selectedPt = selected !== null ? pts[selected] : null;

  const save = async () => {
    const w = parseFloat(input);
    if (!w || !userId) return;
    setSaving(true);
    try {
      const bwCol = database.collections.get<BodyWeightLog>('body_weight_logs');
      const today = toISODate(new Date());
      await database.write(async () => {
        await bwCol.create((r) => {
          r.userId = userId;
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
      setLogging(false);
      setInput('');
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[3] }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing[1] }}>
            Body Weight
          </Text>
          {latest ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>
                {latest.weight}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>kg</Text>
              {diff !== null && (
                <Text style={{
                  color: diff < 0 ? colors.success : diff > 0 ? colors.error : colors.textMuted,
                  fontSize: fontSize.sm, fontWeight: '500',
                }}>
                  {diff > 0 ? '+' : ''}{diff} kg
                </Text>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>No entries yet</Text>
          )}
          {latest && (
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
              Last logged {formatDate(latest.loggedAt)}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => setLogging(true)}
          style={{ backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '500' }}>+ Log</Text>
        </Pressable>
      </View>

      {/* Log input */}
      {logging && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3], backgroundColor: colors.background, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Weight in kg"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            autoFocus
            style={{ flex: 1, color: colors.text, fontSize: fontSize.lg, fontWeight: '600' }}
          />
          <Pressable onPress={() => { setLogging(false); setInput(''); }} hitSlop={8}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
          </Pressable>
          {saving ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Pressable onPress={save} style={{ backgroundColor: colors.text, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
              <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: '600' }}>Save</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Tooltip for selected point */}
      {selectedPt && (
        <View style={{ alignItems: 'center', marginBottom: spacing[2] }}>
          <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: '600' }}>
            {selectedPt.weight} kg
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
            {formatDate(selectedPt.loggedAt)}
          </Text>
        </View>
      )}

      {/* Line chart */}
      {entries.length >= 2 && (
        <>
          <Svg width={CHART_W} height={CHART_H}>
            <Defs>
              <SvgLinearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.text} stopOpacity="0.12" />
                <Stop offset="100%" stopColor={colors.text} stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#bwGrad)" />
            <Path d={linePath} stroke={colors.text} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={selected === i ? 5 : 3}
                fill={selected === i ? colors.text : colors.surface}
                stroke={colors.text}
                strokeWidth={1.5}
                onPress={() => setSelected(selected === i ? null : i)}
              />
            ))}
          </Svg>
          {/* X-axis: first and last dates */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>
              {new Date(entries[0].loggedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>
              {new Date(entries[entries.length - 1].loggedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </>
      )}

      {entries.length === 1 && (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center', paddingVertical: spacing[2] }}>
          Log one more entry to see your trend
        </Text>
      )}

      {entries.length === 0 && !logging && (
        <Pressable onPress={() => setLogging(true)} style={{ paddingVertical: spacing[3], alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            Tap + Log to record your first weigh-in
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Activity Heatmap ─────────────────────────────────────────────────────────

const HEATMAP_WEEKS = 16;

function ActivityHeatmap({ dailySessions, colors, fontSize, spacing, radius }: {
  dailySessions: Record<string, number>;
  colors: any; fontSize: any; spacing: any; radius: any;
}) {
  const today = new Date();
  const todayStr = toISODate(today);
  const todayDow = today.getDay() === 0 ? 7 : today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - (todayDow - 1));

  const columns: { date: string; count: number; isToday: boolean; isFuture: boolean }[][] = [];
  for (let w = HEATMAP_WEEKS - 1; w >= 0; w--) {
    const col: { date: string; count: number; isToday: boolean; isFuture: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(weekStart);
      dt.setDate(weekStart.getDate() - w * 7 + d);
      const dateStr = toISODate(dt);
      col.push({ date: dateStr, count: dailySessions[dateStr] ?? 0, isToday: dateStr === todayStr, isFuture: dt > today });
    }
    columns.push(col);
  }

  const GAP = 2;
  const CELL = Math.floor((SCREEN_W - spacing[5] * 2 - spacing[4] * 2 - (HEATMAP_WEEKS - 1) * GAP) / HEATMAP_WEEKS);

  const oldestDate = columns[0][0].date;
  const midDate = columns[Math.floor(HEATMAP_WEEKS / 2)][0].date;
  const fmtMonth = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short' });

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }}>
      <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: '600', marginBottom: 2 }}>Activity</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[3] }}>Last {HEATMAP_WEEKS} weeks</Text>
      <View style={{ flexDirection: 'row', gap: GAP }}>
        {columns.map((col, ci) => (
          <View key={ci} style={{ gap: GAP }}>
            {col.map((cell, di) => (
              <View
                key={di}
                style={{
                  width: CELL, height: CELL, borderRadius: 2,
                  backgroundColor: cell.count > 0 ? colors.success : colors.text,
                  opacity: cell.isFuture ? 0 : cell.count > 0 ? 1 : 0.1,
                  borderWidth: cell.isToday ? 1 : 0,
                  borderColor: colors.text,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[2] }}>
        <Text style={{ color: colors.textMuted, fontSize: 9 }}>{fmtMonth(oldestDate)}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 9 }}>{fmtMonth(midDate)}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 9 }}>Today</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2] }}>
        <View style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: colors.text, opacity: 0.1 }} />
        <Text style={{ color: colors.textMuted, fontSize: 9 }}>Rest</Text>
        <View style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: colors.success }} />
        <Text style={{ color: colors.textMuted, fontSize: 9 }}>Workout</Text>
      </View>
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

  // Last 10 weeks of volume, HEATMAP_WEEKS for heatmap
  const VOLUME_WEEKS = 10;
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  type WeekBucket = WeekBar & { _start: number };
  const weeks: WeekBucket[] = Array.from({ length: VOLUME_WEEKS }, (_, i) => {
    const d = new Date(thisWeekStart);
    d.setDate(d.getDate() - i * 7);
    return { label: weekLabel(d), volume: 0, sessions: 0, _start: d.getTime() };
  }).reverse();

  const heatmapStart = new Date(thisWeekStart);
  heatmapStart.setDate(heatmapStart.getDate() - (HEATMAP_WEEKS - 1) * 7);

  const allSessions = await sessionsCol
    .query(
      Q.where('user_id', userId),
      Q.where('is_deleted', false),
      Q.where('ended_at', Q.notEq(null)),
      Q.where('started_at', Q.gte(heatmapStart.getTime())),
    )
    .fetch();

  const dailySessions: Record<string, number> = {};
  for (const s of allSessions) {
    const d = toISODate(new Date(s.startedAt));
    dailySessions[d] = (dailySessions[d] ?? 0) + 1;
  }

  // Muscle groups trained this week
  const weekStart = thisWeekStart.getTime();
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
  const weightEntries: WeightEntry[] = bwRaw.slice(0, 60).reverse().map((w) => ({
    date: w.date, weight: w.weight, unit: w.unit, loggedAt: w.loggedAt,
  }));

  return {
    prs: prEntries,
    weekBars: weeks.map(({ label, volume, sessions }) => ({ label, volume, sessions })),
    muscleThisWeek: Array.from(muscleSet).filter((m) => m !== 'cardio'),
    totalSessions: allSessions.length,
    weightEntries,
    dailySessions,
  };
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── 1RM Calculator ──────────────────────────────────────────────────────────

// Epley formula: 1RM = weight × (1 + reps/30)
function epley(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

// Percentage-based rep estimates from 1RM
const RM_PERCENTAGES: { reps: number; pct: number }[] = [
  { reps: 1, pct: 1 }, { reps: 2, pct: 0.97 }, { reps: 3, pct: 0.94 },
  { reps: 4, pct: 0.91 }, { reps: 5, pct: 0.88 }, { reps: 6, pct: 0.85 },
  { reps: 8, pct: 0.8 }, { reps: 10, pct: 0.75 }, { reps: 12, pct: 0.7 },
  { reps: 15, pct: 0.65 },
];

function OneRMCard({ colors, fontSize, fontWeight, spacing, radius }: {
  colors: any; fontSize: any; fontWeight: any; spacing: any; radius: any;
}) {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  const oneRM = !isNaN(w) && !isNaN(r) && w > 0 && r > 0 && r <= 30 ? epley(w, r) : null;

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[4] }}>
      <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: spacing[1] }}>
        1RM Calculator
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[4] }}>
        Estimate your one-rep max using the Epley formula
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing[3], marginBottom: oneRM !== null ? spacing[4] : 0 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[1] }}>Weight</Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g. 100"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            style={{
              backgroundColor: colors.background,
              borderRadius: radius.lg,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              color: colors.text,
              fontSize: fontSize.base,
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: spacing[1] }}>Reps</Text>
          <TextInput
            value={reps}
            onChangeText={setReps}
            placeholder="e.g. 5"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={{
              backgroundColor: colors.background,
              borderRadius: radius.lg,
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
              color: colors.text,
              fontSize: fontSize.base,
            }}
          />
        </View>
      </View>
      {oneRM !== null && (
        <>
          <View style={{ backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing[4], alignItems: 'center', marginBottom: spacing[4] }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 }}>Estimated 1RM</Text>
            <Text style={{ color: colors.text, fontSize: 36, fontWeight: fontWeight.bold }}>
              {Math.round(oneRM)}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>kg / lbs (same unit as input)</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            {RM_PERCENTAGES.filter(p => p.reps !== r || p.reps === 1).map(p => (
              <View
                key={p.reps}
                style={{
                  backgroundColor: p.reps === 1 ? colors.text : colors.background,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[1],
                  minWidth: 68,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: p.reps === 1 ? colors.background : colors.textMuted, fontSize: 10 }}>
                  {p.reps === 1 ? '1RM' : `${p.reps} reps`}
                </Text>
                <Text style={{ color: p.reps === 1 ? colors.background : colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                  {Math.round(oneRM * p.pct)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
      ) : !data || !user ? null : (
        <>
          {/* Activity heatmap */}
          <ActivityHeatmap dailySessions={data.dailySessions} colors={colors} fontSize={fontSize} spacing={spacing} radius={radius} />

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
          <BodyWeightCard
            entries={data.weightEntries}
            userId={user?.id ?? ''}
            onSaved={load}
            colors={colors}
            fontSize={fontSize}
            fontWeight={fontWeight}
            spacing={spacing}
            radius={radius}
          />

          {/* 1RM Calculator */}
          <OneRMCard colors={colors} fontSize={fontSize} fontWeight={fontWeight} spacing={spacing} radius={radius} />

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
