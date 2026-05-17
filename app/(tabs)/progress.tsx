import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { database } from '@/lib/watermelon/database';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { PersonalRecord, Exercise } from '@/lib/watermelon/models';

interface PREntry {
  exerciseId: string;
  exerciseName: string;
  musclePrimary: string[];
  records: { repCount: number; weight: number; unit: string; achievedAt: number }[];
}

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

export default function ProgressTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [entries, setEntries] = useState<PREntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const prCol = database.collections.get<PersonalRecord>('personal_records');
      const exCol = database.collections.get<Exercise>('exercises');

      const prs = await prCol
        .query(Q.where('user_id', user.id), Q.where('is_deleted', false))
        .fetch();

      const map = new Map<string, PREntry>();
      for (const pr of prs) {
        if (!map.has(pr.exerciseId)) {
          let exerciseName = 'Unknown';
          let musclePrimary: string[] = [];
          try {
            const ex = await exCol.find(pr.exerciseId);
            exerciseName = ex.name;
            musclePrimary = ex.musclePrimary;
          } catch {}
          map.set(pr.exerciseId, { exerciseId: pr.exerciseId, exerciseName, musclePrimary, records: [] });
        }
        map.get(pr.exerciseId)!.records.push({
          repCount: pr.repCount,
          weight: pr.weight,
          unit: pr.unit,
          achievedAt: pr.achievedAt,
        });
      }

      const result = Array.from(map.values()).map((e) => ({
        ...e,
        records: [...e.records].sort((a, b) => a.repCount - b.repCount),
      }));

      result.sort((a, b) => {
        const mg = (a.musclePrimary[0] ?? '').localeCompare(b.musclePrimary[0] ?? '');
        return mg !== 0 ? mg : a.exerciseName.localeCompare(b.exerciseName);
      });

      setEntries(result);
      setExpanded(new Set(result.slice(0, 3).map((e) => e.exerciseId)));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing[5], paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing[1] }}>
        Progress
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing[5] }}>
        Personal records · All-time bests
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: spacing[10] }} />
      ) : entries.length === 0 ? (
        <View style={{ marginTop: spacing[10], alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
            No PRs yet.{'\n'}Log your first workout to start tracking bests.
          </Text>
        </View>
      ) : (
        <>
          {/* Summary strip */}
          <View style={[styles.summaryRow, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing[4], marginBottom: spacing[5] }]}>
            <View style={styles.summaryItem}>
              <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
                {entries.length}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>exercises</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
                {entries.reduce((acc, e) => acc + e.records.length, 0)}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>total PRs</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryItem}>
              <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
                {entries.filter((e) => e.records.some((r) => r.repCount === 1)).length}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>1RM tracked</Text>
            </View>
          </View>

          {entries.map((entry) => {
            const isOpen = expanded.has(entry.exerciseId);
            const best = entry.records.find((r) => r.repCount === 1) ?? entry.records[0];
            return (
              <Pressable
                key={entry.exerciseId}
                onPress={() => toggleExpand(entry.exerciseId)}
                style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, marginBottom: spacing[3] }]}
              >
                <View style={[styles.cardHeader, { padding: spacing[4] }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                      {entry.exerciseName}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                      {entry.musclePrimary.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
                    </Text>
                  </View>
                  {best && (
                    <View style={{ alignItems: 'flex-end', marginRight: spacing[3] }}>
                      <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
                        {best.weight}
                        <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.normal }}> {best.unit}</Text>
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{repLabel(best.repCount)}</Text>
                    </View>
                  )}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 32 },
  card: { overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  repBadge: {},
});
