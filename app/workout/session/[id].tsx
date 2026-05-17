import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet, Alert, Share } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { database } from '@/lib/watermelon/database';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { WorkoutSession, SessionExercise, Set as SetModel, Exercise, WorkoutTemplate, TemplateExercise } from '@/lib/watermelon/models';
import { Eyebrow } from '@/components/ui';

interface SetDetail {
  setNumber: number;
  reps: number;
  weight: number;
  unit: string;
  isWarmup: boolean;
  durationSeconds: number | null;
}

interface ExerciseDetail {
  seId: string;
  exerciseId: string;
  exerciseName: string;
  musclePrimary: string[];
  sets: SetDetail[];
}

function formatDurationDisplay(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

interface SessionDetail {
  startedAt: number;
  endedAt: number | null;
  exercises: ExerciseDetail[];
  totalSets: number;
  totalVolume: number;
}

// Group exercises by their first primary muscle
function groupByMuscle(exercises: ExerciseDetail[]): { group: string; items: ExerciseDetail[] }[] {
  const ORDER = ['chest', 'lats', 'mid_back', 'lower_back', 'front_delt', 'mid_delt', 'rear_delt',
    'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core', 'obliques', 'traps', 'forearms'];

  const map = new Map<string, ExerciseDetail[]>();
  for (const ex of exercises) {
    const key = ex.musclePrimary[0] ?? 'other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ex);
  }

  const groups = Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  groups.sort((a, b) => {
    const ai = ORDER.indexOf(a.group);
    const bi = ORDER.indexOf(b.group);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return groups;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDuration(startMs: number, endMs: number): string {
  const m = Math.round((endMs - startMs) / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function SessionDetailScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const handleShare = useCallback(() => {
    if (!detail) return;
    const muscles = [...new Set(detail.exercises.flatMap((e) => e.musclePrimary))].slice(0, 4);
    const duration = detail.endedAt ? formatDuration(detail.startedAt, detail.endedAt) : '';
    const sets = detail.totalSets;
    const vol = detail.totalVolume > 0
      ? ` · ${detail.totalVolume >= 1000 ? `${(detail.totalVolume / 1000).toFixed(1)}k` : detail.totalVolume} kg vol`
      : '';
    const muscleStr = muscles.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ');
    Share.share({
      message: `🏋️ Just finished a workout on Pumped!\n\n${duration ? `${duration} · ` : ''}${sets} sets${vol}\n${muscleStr}\n\nhttps://pumpedapp.io`,
    });
  }, [detail]);

  const handleSaveAsTemplate = useCallback(() => {
    if (!detail || !user) return;
    Alert.prompt(
      'Save as Template',
      'Give this template a name:',
      async (name) => {
        if (!name?.trim()) return;
        setSavingTemplate(true);
        try {
          const tCol = database.collections.get<WorkoutTemplate>('workout_templates');
          const teCol = database.collections.get<TemplateExercise>('template_exercises');
          await database.write(async () => {
            const t = await tCol.create((r) => {
              r.userId = user.id;
              r.name = name.trim();
              r.notes = null;
              r.createdAt = Date.now();
              r.isDeleted = false;
              r.remoteId = null;
              r.syncedAt = null;
            });
            for (let i = 0; i < detail.exercises.length; i++) {
              const ex = detail.exercises[i];
              const workingSets = ex.sets.filter((s) => !s.isWarmup);
              const lastSet = workingSets[workingSets.length - 1] ?? ex.sets[0];
              await teCol.create((r) => {
                r.templateId = t.id;
                r.exerciseId = ex.exerciseId;
                r.orderIndex = i;
                r.defaultSets = Math.max(workingSets.length, 1);
                r.defaultReps = lastSet?.reps ?? 10;
                r.defaultWeight = lastSet?.weight ?? 0;
                r.defaultUnit = lastSet?.unit ?? 'kg';
                r.isDeleted = false;
                r.remoteId = null;
                r.syncedAt = null;
              });
            }
          });
          Alert.alert('Template saved!', `"${name.trim()}" is ready to use.`);
        } finally {
          setSavingTemplate(false);
        }
      },
      'plain-text',
      '',
    );
  }, [detail, user]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const sessionsCollection = database.collections.get<WorkoutSession>('workout_sessions');
        const seCollection = database.collections.get<SessionExercise>('session_exercises');
        const exercisesCollection = database.collections.get<Exercise>('exercises');

        const session = await sessionsCollection.find(id);
        const sessionExercises = await seCollection
          .query(Q.where('session_id', id), Q.where('is_deleted', false), Q.sortBy('order_index', Q.asc))
          .fetch();

        let totalSets = 0;
        let totalVolume = 0;
        const exercises: ExerciseDetail[] = [];

        for (const se of sessionExercises) {
          const setsRaw = await se.sets.fetch() as SetModel[];
          const activeSets = setsRaw
            .filter((s) => !s.isDeleted)
            .sort((a, b) => a.setNumber - b.setNumber);

          let exerciseName = 'Unknown Exercise';
          let musclePrimary: string[] = [];
          try {
            const ex = await exercisesCollection.find(se.exerciseId);
            exerciseName = ex.name;
            musclePrimary = ex.musclePrimary;
          } catch {}

          const setDetails: SetDetail[] = activeSets.map((s) => ({
            setNumber: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            unit: s.unit,
            isWarmup: s.isWarmup,
            durationSeconds: s.durationSeconds ?? null,
          }));

          totalSets += setDetails.length;
          totalVolume += setDetails.reduce((acc, s) => acc + s.reps * s.weight, 0);
          exercises.push({ seId: se.id, exerciseId: se.exerciseId, exerciseName, musclePrimary, sets: setDetails });
        }

        setDetail({ startedAt: session.startedAt, endedAt: session.endedAt, exercises, totalSets, totalVolume });
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

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
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3], flex: 1 }}>
          Session
        </Text>
        {detail && (
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <Pressable
              onPress={handleShare}
              style={[styles.editBtn, { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }]}
            >
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Share</Text>
            </Pressable>
            <Pressable
              onPress={handleSaveAsTemplate}
              disabled={savingTemplate}
              style={[styles.editBtn, { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }]}
            >
              {savingTemplate
                ? <ActivityIndicator size="small" color={colors.textMuted} />
                : <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Template</Text>}
            </Pressable>
            <Pressable
              onPress={() => router.push(`/workout/edit/${id}`)}
              style={[styles.editBtn, { borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[2] }]}
            >
              <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>Edit</Text>
            </Pressable>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : notFound || !detail ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>Session not found.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: insets.bottom + 32 }}
        >
          {/* Date + stats row */}
          <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
            {formatDate(detail.startedAt)}
          </Text>
          <View style={[styles.statsRow, { marginTop: spacing[3], marginBottom: spacing[6] }]}>
            {detail.endedAt && (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {formatDuration(detail.startedAt, detail.endedAt)}
              </Text>
            )}
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
              {detail.totalSets} set{detail.totalSets !== 1 ? 's' : ''}
            </Text>
            {detail.totalVolume > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {detail.totalVolume.toLocaleString()} total vol
              </Text>
            )}
          </View>

          {/* Exercises grouped by muscle type */}
          {groupByMuscle(detail.exercises).map(({ group, items }) => (
            <View key={group} style={{ marginBottom: spacing[5] }}>
              {/* Muscle group section header */}
              <Eyebrow>{MUSCLE_GROUP_LABELS[group] ?? group}</Eyebrow>

              {items.map((ex) => {
                const isCardio = ex.musclePrimary.includes('cardio');
                return (
                  <View
                    key={ex.seId}
                    style={[
                      styles.exerciseCard,
                      { borderColor: colors.border, borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[3] },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 2 }}>
                      {ex.exerciseName}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing[3] }}>
                      {ex.musclePrimary.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
                    </Text>

                    {/* Set table */}
                    <View style={[styles.setRow, { marginBottom: spacing[1] }]}>
                      <Text style={[styles.setNum, { color: colors.textMuted, fontSize: fontSize.xs }]}>#</Text>
                      {isCardio ? (
                        <Text style={[styles.setWide, { color: colors.textMuted, fontSize: fontSize.xs }]}>Duration</Text>
                      ) : (
                        <>
                          <Text style={[styles.setWide, { color: colors.textMuted, fontSize: fontSize.xs }]}>Reps</Text>
                          <Text style={[styles.setWide, { color: colors.textMuted, fontSize: fontSize.xs }]}>Weight</Text>
                          <Text style={[styles.setWide, { color: colors.textMuted, fontSize: fontSize.xs }]}>Vol</Text>
                        </>
                      )}
                    </View>

                    {ex.sets.map((s) => (
                      <View key={s.setNumber} style={[styles.setRow, { paddingVertical: 3 }]}>
                        <Text style={[styles.setNum, { color: s.isWarmup ? colors.textMuted : colors.text, fontSize: fontSize.sm }]}>
                          {s.isWarmup ? 'W' : s.setNumber}
                        </Text>
                        {isCardio ? (
                          <Text style={[styles.setWide, { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                            {s.durationSeconds ? formatDurationDisplay(s.durationSeconds) : '—'}
                          </Text>
                        ) : (
                          <>
                            <Text style={[styles.setWide, { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                              {s.reps}
                            </Text>
                            <Text style={[styles.setWide, { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                              {s.weight} {s.unit}
                            </Text>
                            <Text style={[styles.setWide, { color: colors.textMuted, fontSize: fontSize.sm }]}>
                              {(s.reps * s.weight).toLocaleString()}
                            </Text>
                          </>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 16 },
  exerciseCard: { borderWidth: 1 },
  setRow: { flexDirection: 'row', alignItems: 'center' },
  setNum: { width: 28, textAlign: 'center' },
  setWide: { width: 72, textAlign: 'center' },
  editBtn: { borderWidth: 1 },
});
