import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';
import { database } from '@/lib/watermelon/database';
import type { WorkoutSession } from '@/lib/watermelon/models';
import { suggestExercises, exerciseNamesByIds, type ExerciseSuggestion } from '@/lib/workout/planSuggestions';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Cardio', 'Full Body',
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(year: number, month: number): Date { return new Date(year, month, 1); }
function daysInMonth(year: number, month: number): number { return new Date(year, month + 1, 0).getDate(); }
function isoDay(d: Date): number { return d.getDay() === 0 ? 7 : d.getDay(); }

interface DayData {
  date: string;
  sessionId: string | null;
  isRestDay: boolean;
  restDayId: string | null;
  planned: string[];
  plannedExerciseIds: string[];
  plannedId: string | null;
}

interface PlanModal {
  date: string;
  existingId: string | null;
  isEditing: boolean;
}

export default function CalendarScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [dayMap, setDayMap] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);

  const [planModal, setPlanModal] = useState<PlanModal | null>(null);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  // All available exercises for the selected muscles
  const [availableExercises, setAvailableExercises] = useState<ExerciseSuggestion[]>([]);
  // Name map for view mode (id → name)
  const [viewExerciseNames, setViewExerciseNames] = useState<Record<string, string>>({});
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [saving, setSaving] = useState(false);

  const todayStr = toISODate(now);

  // Reload available exercises when muscle groups change (edit mode)
  useEffect(() => {
    if (!planModal?.isEditing) return;
    if (selectedMuscles.length === 0) { setAvailableExercises([]); return; }
    setLoadingExercises(true);
    suggestExercises(selectedMuscles)
      .then((exs) => {
        setAvailableExercises(exs);
        // Drop selected exercises that no longer belong to any selected muscle group
        const validIds = new Set(exs.map(e => e.id));
        setSelectedExerciseIds(prev => prev.filter(id => validIds.has(id)));
      })
      .catch(() => setAvailableExercises([]))
      .finally(() => setLoadingExercises(false));
  }, [selectedMuscles, planModal?.isEditing]);

  // Load exercise names for view mode
  useEffect(() => {
    if (!planModal || planModal.isEditing) return;
    const day = dayMap.get(planModal.date);
    const ids = day?.plannedExerciseIds ?? [];
    if (ids.length === 0) { setViewExerciseNames({}); return; }
    exerciseNamesByIds(ids).then(setViewExerciseNames).catch(() => setViewExerciseNames({}));
  }, [planModal?.date, planModal?.isEditing, dayMap]);

  const loadMonth = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const monthStart = startOfMonth(year, month);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const sessionsCol = database.collections.get<WorkoutSession>('workout_sessions');
      const sessions = await sessionsCol
        .query(Q.where('user_id', user.id), Q.where('is_deleted', false), Q.where('ended_at', Q.notEq(null)), Q.where('started_at', Q.between(monthStart.getTime(), monthEnd.getTime())))
        .fetch();
      const isoStart = toISODate(monthStart);
      const isoEnd = toISODate(monthEnd);
      const { data: restDays } = await supabase.from('rest_days').select('id, date').eq('user_id', user.id).gte('date', isoStart).lte('date', isoEnd);
      const { data: plannedDays } = await supabase.from('planned_workouts').select('id, date, muscle_groups, exercise_ids').eq('user_id', user.id).gte('date', isoStart).lte('date', isoEnd);

      const map = new Map<string, DayData>();
      for (const s of sessions) {
        const dateStr = toISODate(new Date(s.startedAt));
        if (!map.has(dateStr)) map.set(dateStr, { date: dateStr, sessionId: s.id, isRestDay: false, restDayId: null, planned: [], plannedExerciseIds: [], plannedId: null });
      }
      for (const rd of (restDays ?? [])) {
        const ex = map.get(rd.date);
        if (ex) { ex.isRestDay = true; ex.restDayId = rd.id; }
        else map.set(rd.date, { date: rd.date, sessionId: null, isRestDay: true, restDayId: rd.id, planned: [], plannedExerciseIds: [], plannedId: null });
      }
      for (const pw of (plannedDays ?? [])) {
        const ex = map.get(pw.date);
        const muscles = pw.muscle_groups ?? [];
        const exIds = pw.exercise_ids ?? [];
        if (ex) { ex.planned = muscles; ex.plannedExerciseIds = exIds; ex.plannedId = pw.id; }
        else map.set(pw.date, { date: pw.date, sessionId: null, isRestDay: false, restDayId: null, planned: muscles, plannedExerciseIds: exIds, plannedId: pw.id });
      }
      setDayMap(map);
    } finally {
      setLoading(false);
    }
  }, [user, year, month]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const openModal = useCallback((dateStr: string) => {
    const data = dayMap.get(dateStr);
    const hasExisting = !!data?.plannedId;
    setPlanModal({ date: dateStr, existingId: data?.plannedId ?? null, isEditing: !hasExisting });
    setSelectedMuscles(data?.planned ?? []);
    setSelectedExerciseIds(data?.plannedExerciseIds ?? []);
    setAvailableExercises([]);
    setViewExerciseNames({});
  }, [dayMap]);

  const handleDayPress = useCallback((dateStr: string) => {
    const data = dayMap.get(dateStr);
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;

    if (data?.sessionId) { router.push(`/workout/session/${data.sessionId}`); return; }

    if (data?.isRestDay && data.restDayId) {
      Alert.alert('Rest Day', `${dateStr} is marked as a rest day.`, [
        { text: 'OK', style: 'cancel' },
        { text: 'Remove Rest Day', style: 'destructive', onPress: async () => { await supabase.from('rest_days').delete().eq('id', data.restDayId!); loadMonth(); } },
      ]);
      return;
    }

    if (isFuture) { openModal(dateStr); return; }

    if (isPast || isToday) {
      Alert.alert('Mark as Rest Day?', `Mark ${dateStr} as a rest day?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Rest Day', onPress: async () => { if (!user) return; await supabase.from('rest_days').upsert({ user_id: user.id, date: dateStr }, { onConflict: 'user_id,date' }); loadMonth(); } },
      ]);
    }
  }, [dayMap, todayStr, user, loadMonth, openModal]);

  const toggleMuscle = (mg: string) => {
    setSelectedMuscles(prev => prev.includes(mg) ? prev.filter(m => m !== mg) : [...prev, mg]);
  };

  const toggleExercise = (id: string) => {
    setSelectedExerciseIds(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]);
  };

  const handleSavePlan = async () => {
    if (!user || !planModal) return;
    setSaving(true);
    try {
      let err: { message: string } | null = null;
      const payload = { muscle_groups: selectedMuscles, exercise_ids: selectedExerciseIds };

      if (selectedMuscles.length === 0 && planModal.existingId) {
        const { error } = await supabase.from('planned_workouts').delete().eq('id', planModal.existingId);
        err = error;
      } else if (planModal.existingId) {
        const { error } = await supabase.from('planned_workouts').update(payload).eq('id', planModal.existingId);
        err = error;
      } else {
        const { error } = await supabase.from('planned_workouts').insert({ user_id: user.id, date: planModal.date, ...payload });
        err = error;
      }

      if (err) {
        Alert.alert('Could not save', err.message.includes('does not exist') ? 'Run the planned_workouts SQL migration in Supabase first.' : err.message);
        return;
      }
      setPlanModal(null);
      loadMonth();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!user || !planModal?.existingId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('planned_workouts').delete().eq('id', planModal.existingId);
      if (error) { Alert.alert('Error', error.message); return; }
      setPlanModal(null);
      loadMonth();
    } finally {
      setSaving(false);
    }
  };

  // Calendar grid
  const firstDay = startOfMonth(year, month);
  const totalDays = daysInMonth(year, month);
  const leadingBlanks = isoDay(firstDay) - 1;
  const monthName = firstDay.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const cellSize = Math.floor((350 - 6 * 4) / 7);
  const s = spacing;

  // Group available exercises by muscle group for edit mode
  const exercisesByGroup: Record<string, ExerciseSuggestion[]> = {};
  for (const ex of availableExercises) {
    if (!exercisesByGroup[ex.group]) exercisesByGroup[ex.group] = [];
    exercisesByGroup[ex.group].push(ex);
  }

  const viewDay = planModal ? dayMap.get(planModal.date) : undefined;
  const viewMuscles = viewDay?.planned ?? [];
  const viewExerciseIds = viewDay?.plannedExerciseIds ?? [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: s[5], paddingBottom: s[3], borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: s[3] }}>Calendar</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: s[5], paddingBottom: insets.bottom + 32 }}>
        <View style={[styles.monthNav, { marginTop: s[5], marginBottom: s[4] }]}>
          <Pressable onPress={prevMonth} hitSlop={12} style={[styles.navBtn, { borderColor: colors.border, borderRadius: radius.md }]}>
            <Text style={{ color: colors.text, fontSize: fontSize.base }}>‹</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.semibold }}>{monthName}</Text>
          <Pressable onPress={nextMonth} hitSlop={12} style={[styles.navBtn, { borderColor: colors.border, borderRadius: radius.md }]}>
            <Text style={{ color: colors.text, fontSize: fontSize.base }}>›</Text>
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((d) => (
            <View key={d} style={[styles.dayCell, { width: cellSize }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' }}>{d}</Text>
            </View>
          ))}
        </View>

        {loading ? <ActivityIndicator color={colors.text} style={{ marginTop: s[8] }} /> : (
          rows.map((row, ri) => (
            <View key={ri} style={styles.weekRow}>
              {row.map((day, ci) => {
                if (!day) return <View key={ci} style={[styles.dayCell, { width: cellSize }]} />;
                const d = new Date(year, month, day);
                const dateStr = toISODate(d);
                const data = dayMap.get(dateStr);
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                const hasSession = !!data?.sessionId;
                const isRest = !!data?.isRestDay;
                const hasPlanned = (data?.planned?.length ?? 0) > 0;
                return (
                  <Pressable
                    key={ci}
                    onPress={() => handleDayPress(dateStr)}
                    style={({ pressed }) => [styles.dayCell, { width: cellSize, height: cellSize, borderRadius: radius.md, backgroundColor: isToday ? colors.text : hasSession ? colors.surface : 'transparent', opacity: pressed ? 0.7 : 1, justifyContent: 'center', alignItems: 'center' }]}
                  >
                    <Text style={{ color: isToday ? colors.background : isFuture ? colors.textMuted : colors.text, fontSize: fontSize.sm, fontWeight: isToday ? fontWeight.bold : fontWeight.normal }}>
                      {day}
                    </Text>
                    {(hasSession || isRest || hasPlanned) && (
                      <View style={styles.dotRow}>
                        {hasSession && <View style={[styles.dot, { backgroundColor: isToday ? colors.background : colors.success }]} />}
                        {isRest && !hasSession && <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />}
                        {hasPlanned && !hasSession && <View style={[styles.dot, { backgroundColor: colors.warning }]} />}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}

        <View style={[styles.legend, { marginTop: s[5] }]}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.success }]} /><Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 6 }}>Workout</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.warning }]} /><Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 6 }}>Planned</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: colors.textMuted }]} /><Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: 6 }}>Rest day</Text></View>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: s[3], textAlign: 'center' }}>
          Tap a future day to plan · Tap a past day to log rest
        </Text>
      </ScrollView>

      {/* Plan modal */}
      <Modal visible={!!planModal} transparent animationType="slide" onRequestClose={() => setPlanModal(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPlanModal(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: s[4] }} />

            {/* Title row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s[4] }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
                  {planModal?.isEditing ? (planModal.existingId ? 'Edit Plan' : 'Plan Workout') : 'Planned Workout'}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 }}>{planModal?.date}</Text>
              </View>
              {!planModal?.isEditing && (
                <Pressable
                  onPress={() => {
                    // switching to edit — load existing exercises into available list
                    setPlanModal(prev => prev ? { ...prev, isEditing: true } : null);
                  }}
                  style={{ backgroundColor: colors.background, borderRadius: radius.md, paddingVertical: s[2], paddingHorizontal: s[3] }}
                >
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Edit</Text>
                </Pressable>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* ── Muscle groups ── */}
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' as const, letterSpacing: 0.8, marginBottom: 8 }}>MUSCLE GROUPS</Text>
              {planModal?.isEditing ? (
                <View style={[styles.chipRow, { marginBottom: s[4] }]}>
                  {MUSCLE_GROUPS.map((mg) => {
                    const active = selectedMuscles.includes(mg);
                    return (
                      <Pressable key={mg} onPress={() => toggleMuscle(mg)}
                        style={{ backgroundColor: active ? colors.text : colors.background, borderRadius: radius.md, paddingVertical: s[2], paddingHorizontal: s[3] }}
                      >
                        <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>{mg}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={[styles.chipRow, { marginBottom: s[4] }]}>
                  {viewMuscles.map((mg) => (
                    <View key={mg} style={{ backgroundColor: colors.text, borderRadius: radius.md, paddingVertical: s[2], paddingHorizontal: s[3] }}>
                      <Text style={{ color: colors.background, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>{mg}</Text>
                    </View>
                  ))}
                  {viewMuscles.length === 0 && <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>None selected</Text>}
                </View>
              )}

              {/* ── Exercises ── */}
              {planModal?.isEditing ? (
                <>
                  {loadingExercises && <ActivityIndicator size="small" color={colors.textMuted} style={{ marginBottom: s[4] }} />}
                  {!loadingExercises && selectedMuscles.length > 0 && (
                    <>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' as const, letterSpacing: 0.8, marginBottom: 8 }}>EXERCISES</Text>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: s[3] }}>
                        Select the exercises you plan to do
                      </Text>
                      {Object.entries(exercisesByGroup).map(([group, exercises]) => (
                        <View key={group} style={{ marginBottom: s[3] }}>
                          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', marginBottom: s[2] }}>{group.toUpperCase()}</Text>
                          {exercises.map((ex) => {
                            const selected = selectedExerciseIds.includes(ex.id);
                            return (
                              <Pressable
                                key={ex.id}
                                onPress={() => toggleExercise(ex.id)}
                                style={({ pressed }) => ({
                                  flexDirection: 'row', alignItems: 'center',
                                  paddingVertical: s[3], paddingHorizontal: s[3],
                                  marginBottom: 2, borderRadius: radius.md,
                                  backgroundColor: selected ? colors.text + '12' : 'transparent',
                                  opacity: pressed ? 0.7 : 1,
                                })}
                              >
                                <View style={{
                                  width: 20, height: 20, borderRadius: 4,
                                  borderWidth: 1.5, borderColor: selected ? colors.text : colors.border,
                                  backgroundColor: selected ? colors.text : 'transparent',
                                  alignItems: 'center', justifyContent: 'center',
                                  marginRight: s[3],
                                }}>
                                  {selected && <Text style={{ color: colors.background, fontSize: 11, fontWeight: '700' }}>✓</Text>}
                                </View>
                                <Text style={{ color: colors.text, fontSize: fontSize.base, flex: 1 }}>{ex.name}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ))}
                    </>
                  )}
                </>
              ) : (
                viewExerciseIds.length > 0 && (
                  <>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' as const, letterSpacing: 0.8, marginBottom: 8 }}>EXERCISES</Text>
                    <View style={{ marginBottom: s[4] }}>
                      {viewExerciseIds.map((id) => {
                        const name = viewExerciseNames[id];
                        if (!name) return null;
                        return (
                          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: s[2] }}>
                            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.warning, marginRight: s[3] }} />
                            <Text style={{ color: colors.text, fontSize: fontSize.base }}>{name}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )
              )}
            </ScrollView>

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: s[3], marginTop: s[3] }}>
              {planModal?.existingId && (
                <Pressable onPress={handleDeletePlan} disabled={saving}
                  style={({ pressed }) => ({ flex: 1, backgroundColor: colors.error + '18', borderRadius: radius.lg, paddingVertical: s[4], opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ color: colors.error, fontSize: fontSize.base, textAlign: 'center' }}>Remove</Text>
                </Pressable>
              )}
              {planModal?.isEditing ? (
                <Pressable onPress={handleSavePlan} disabled={saving || selectedMuscles.length === 0}
                  style={({ pressed }) => ({ flex: 2, backgroundColor: selectedMuscles.length === 0 ? colors.border : colors.text, borderRadius: radius.lg, paddingVertical: s[4], opacity: pressed ? 0.8 : 1 })}
                >
                  {saving
                    ? <ActivityIndicator color={colors.background} />
                    : <Text style={{ color: selectedMuscles.length === 0 ? colors.textMuted : colors.background, fontSize: fontSize.base, fontWeight: fontWeight.semibold, textAlign: 'center' }}>Save Plan</Text>
                  }
                </Pressable>
              ) : (
                <Pressable onPress={() => setPlanModal(prev => prev ? { ...prev, isEditing: true } : null)}
                  style={({ pressed }) => ({ flex: 2, backgroundColor: colors.text, borderRadius: radius.lg, paddingVertical: s[4], opacity: pressed ? 0.8 : 1 })}
                >
                  <Text style={{ color: colors.background, fontSize: fontSize.base, fontWeight: fontWeight.semibold, textAlign: 'center' }}>Edit Plan</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  weekRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  dayCell: { alignItems: 'center', justifyContent: 'center', aspectRatio: 1 },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { paddingHorizontal: 20, paddingTop: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
