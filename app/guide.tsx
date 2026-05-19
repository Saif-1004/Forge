import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Modal,
  StyleSheet, FlatList, SectionList, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { EXERCISES, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from '@/data/exercises';
import { FORM_CUES } from '@/data/formCues';
import { ExerciseImage } from '@/components/ExerciseImage';

// ── Types ────────────────────────────────────────────────────────────────────

interface GuideExercise {
  name: string;
  musclePrimary: string[];
  muscleSecondary: string[];
  equipment: string | null;
}

// ── Filters ──────────────────────────────────────────────────────────────────

const MUSCLE_FILTERS = [
  { key: 'chest', label: 'Chest' },
  { key: 'lats', label: 'Back' },
  { key: 'front_delt', label: 'Shoulders' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'quads', label: 'Quads' },
  { key: 'hamstrings', label: 'Hamstrings' },
  { key: 'glutes', label: 'Glutes' },
  { key: 'core', label: 'Core' },
  { key: 'calves', label: 'Calves' },
  { key: 'traps', label: 'Traps' },
  { key: 'cardio', label: 'Cardio' },
];

const EQUIPMENT_FILTERS = [
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'cable', label: 'Cable' },
  { key: 'machine', label: 'Machine' },
  { key: 'null', label: 'Bodyweight' },
  { key: 'kettlebell', label: 'Kettlebell' },
];

// ── Detail Modal ─────────────────────────────────────────────────────────────

function ExerciseDetailModal({ exercise, onClose }: {
  exercise: GuideExercise | null;
  onClose: () => void;
}) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  if (!exercise) return null;
  const cue = FORM_CUES[exercise.name];
  const imgWidth = screenWidth - spacing[5] * 2;
  const imgHeight = Math.round(imgWidth * 0.6);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[styles.modalHeader, {
          paddingTop: insets.top + 16,
          paddingHorizontal: spacing[5],
          paddingBottom: spacing[4],
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>✕</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, flex: 1, marginLeft: spacing[4] }} numberOfLines={2}>
            {exercise.name}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Exercise image / animation */}
          <View style={{ marginBottom: spacing[5] }}>
            <ExerciseImage
              exerciseName={exercise.name}
              musclePrimary={exercise.musclePrimary}
              muscleSecondary={exercise.muscleSecondary}
              width={imgWidth}
              height={imgHeight}
            />
          </View>

          {/* Muscle tags */}
          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing[2] }}>
            MUSCLES
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[5] }}>
            {exercise.musclePrimary.map(m => (
              <View key={m} style={{ backgroundColor: colors.warning + '22', borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }}>
                <Text style={{ color: colors.warning, fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>
                  {MUSCLE_GROUP_LABELS[m] ?? m}
                </Text>
              </View>
            ))}
            {exercise.muscleSecondary.map(m => (
              <View key={m} style={{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                  {MUSCLE_GROUP_LABELS[m] ?? m}
                </Text>
              </View>
            ))}
          </View>

          {/* Equipment */}
          {exercise.equipment && (
            <>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing[2] }}>
                EQUIPMENT
              </Text>
              <View style={{ flexDirection: 'row', marginBottom: spacing[5] }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.sm }}>
                    {EQUIPMENT_LABELS[exercise.equipment] ?? exercise.equipment}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Form cues */}
          {cue ? (
            <>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing[3] }}>
                FORM CUES
              </Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing[4] }}>
                {cue.cues.map((c, i) => (
                  <View key={i} style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: colors.text,
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: spacing[3], marginTop: 1, flexShrink: 0,
                    }}>
                      <Text style={{ color: colors.background, fontSize: 11, fontWeight: fontWeight.bold }}>
                        {i + 1}
                      </Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, flex: 1, lineHeight: 20 }}>
                      {c}
                    </Text>
                  </View>
                ))}
              </View>
              {cue.tips && (
                <View style={{ backgroundColor: colors.warning + '15', borderRadius: radius.lg, padding: spacing[4], marginBottom: spacing[4], borderLeftWidth: 3, borderLeftColor: colors.warning }}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 }}>
                    PRO TIP
                  </Text>
                  <Text style={{ color: colors.text, fontSize: fontSize.sm, lineHeight: 20 }}>
                    {cue.tips}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing[5], alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' }}>
                Focus on the primary muscles shown above.{'\n'}Keep form controlled throughout each rep.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function GuideScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<GuideExercise | null>(null);

  const allExercises: GuideExercise[] = useMemo(() =>
    EXERCISES.map(e => ({
      name: e.name,
      musclePrimary: e.muscle_primary,
      muscleSecondary: e.muscle_secondary,
      equipment: e.equipment,
    })),
    [],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return allExercises.filter(e => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (muscleFilter) {
        // Back filter covers multiple muscle keys
        if (muscleFilter === 'lats') {
          if (!e.musclePrimary.some(m => ['lats', 'mid_back', 'lower_back', 'traps'].includes(m))) return false;
        } else if (!e.musclePrimary.includes(muscleFilter)) return false;
      }
      if (equipmentFilter) {
        if (equipmentFilter === 'null' && e.equipment !== null) return false;
        if (equipmentFilter !== 'null' && e.equipment !== equipmentFilter) return false;
      }
      return true;
    });
  }, [allExercises, query, muscleFilter, equipmentFilter]);

  const grouped = useMemo(() => {
    if (query.trim() || muscleFilter || equipmentFilter) return null;
    const map = new Map<string, GuideExercise[]>();
    for (const ex of allExercises) {
      const key = ex.musclePrimary[0] ?? 'other';
      const label = MUSCLE_GROUP_LABELS[key] ?? key;
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(ex);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [allExercises, query, muscleFilter, equipmentFilter]);

  const toggleMuscle = useCallback((key: string) => {
    setMuscleFilter(prev => prev === key ? null : key);
  }, []);

  const toggleEquipment = useCallback((key: string) => {
    setEquipmentFilter(prev => prev === key ? null : key);
  }, []);

  const renderExerciseRow = useCallback(({ item }: { item: GuideExercise }) => (
    <Pressable
      onPress={() => setSelected(item)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[5],
        paddingVertical: spacing[3] + 2,
        backgroundColor: pressed ? colors.surface : colors.background,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium }}>
          {item.name}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
          {item.musclePrimary.map(m => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
          {item.equipment ? ` · ${EQUIPMENT_LABELS[item.equipment] ?? item.equipment}` : ' · Bodyweight'}
        </Text>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>›</Text>
    </Pressable>
  ), [colors, fontSize, fontWeight, spacing]);

  const renderSeparator = useCallback(() => (
    <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing[5] }} />
  ), [colors, spacing]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View style={{ backgroundColor: colors.background, paddingHorizontal: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[1] }}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8 }}>
        {section.title.toUpperCase()}
      </Text>
    </View>
  ), [colors, fontSize, spacing]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, {
        paddingTop: insets.top + 12,
        paddingHorizontal: spacing[5],
        paddingBottom: spacing[3],
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3] }}>
          Exercise Guide
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginLeft: spacing[2] }}>
          {filtered.length > 0 ? `${filtered.length}` : grouped ? allExercises.length.toString() : '0'}
        </Text>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3] }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base, marginRight: spacing[2] }}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises…"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, fontSize: fontSize.base, paddingVertical: spacing[3] }}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Muscle filters */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing[5], paddingVertical: spacing[2], gap: spacing[2] }}
        >
          {MUSCLE_FILTERS.map(f => (
            <Pressable
              key={f.key}
              onPress={() => toggleMuscle(f.key)}
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1] + 2,
                borderRadius: radius.full ?? 999,
                backgroundColor: muscleFilter === f.key ? colors.text : colors.surface,
              }}
            >
              <Text style={{ color: muscleFilter === f.key ? colors.background : colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.medium }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Equipment filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[2], gap: spacing[2] }}
        >
          {EQUIPMENT_FILTERS.map(f => (
            <Pressable
              key={f.key}
              onPress={() => toggleEquipment(f.key)}
              style={{
                paddingHorizontal: spacing[3],
                paddingVertical: spacing[1] + 2,
                borderRadius: radius.full ?? 999,
                backgroundColor: equipmentFilter === f.key ? colors.warning : colors.surface,
              }}
            >
              <Text style={{ color: equipmentFilter === f.key ? '#000' : colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.medium }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Exercise list */}
      {filtered.length === 0 && (query || muscleFilter || equipmentFilter) ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.base, textAlign: 'center' }}>
            No exercises match your filters.
          </Text>
        </View>
      ) : grouped && !query && !muscleFilter && !equipmentFilter ? (
        <SectionList
          sections={grouped}
          keyExtractor={item => item.name}
          renderItem={renderExerciseRow}
          renderSectionHeader={renderSectionHeader}
          ItemSeparatorComponent={renderSeparator}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.name}
          renderItem={renderExerciseRow}
          ItemSeparatorComponent={renderSeparator}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}

      {/* Detail modal */}
      <ExerciseDetailModal exercise={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
});
