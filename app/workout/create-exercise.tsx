import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { database } from '@/lib/watermelon/database';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { Exercise, SessionExercise } from '@/lib/watermelon/models';
import { Eyebrow, Chip } from '@/components/ui';

const MUSCLE_OPTIONS = [
  'chest', 'lats', 'mid_back', 'lower_back',
  'front_delt', 'mid_delt', 'rear_delt',
  'biceps', 'triceps', 'quads', 'hamstrings',
  'glutes', 'calves', 'core', 'obliques', 'traps', 'forearms', 'cardio',
];

const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell', 'Band', 'Smith Machine', 'Other'];

export default function CreateExerciseScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { addExercise } = useWorkoutStore();
  const { editSessionId } = useLocalSearchParams<{ editSessionId?: string }>();

  const [name, setName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState<string | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const toggleSecondary = (m: string) => {
    setSecondaryMuscles((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setNameError('Exercise name is required'); return; }
    if (!primaryMuscle) { setNameError('Select a primary muscle group'); return; }
    if (!user) return;

    setSaving(true);
    try {
      const exCol = database.collections.get<Exercise>('exercises');

      // Check for duplicate name
      const existing = await exCol.query(Q.where('name', trimmed)).fetchCount();
      if (existing > 0) {
        setNameError(`"${trimmed}" already exists in your library`);
        setSaving(false);
        return;
      }

      let newEx: Exercise;
      await database.write(async () => {
        newEx = await exCol.create((r) => {
          r.name = trimmed;
          r.musclePrimaryRaw = JSON.stringify([primaryMuscle!]);
          r.muscleSecondaryRaw = JSON.stringify(secondaryMuscles);
          r.equipment = equipment ?? '';
          r.isCustom = true;
          r.createdBy = user.id;
          r.remoteId = null;
          r.syncedAt = null;
        });
      });

      // Add to active session or edit session
      if (editSessionId) {
        const seCol = database.collections.get<SessionExercise>('session_exercises');
        const count = await seCol.query(Q.where('session_id', editSessionId), Q.where('is_deleted', false)).fetchCount();
        await database.write(async () => {
          await seCol.create((record) => {
            record.sessionId = editSessionId;
            record.exerciseId = newEx!.id;
            record.exerciseRemoteId = null;
            record.orderIndex = count;
            record.notes = null;
            record.isDeleted = false;
            record.remoteId = null;
            record.syncedAt = null;
          });
        });
      } else {
        await addExercise({ id: newEx!.id, name: trimmed, musclePrimary: [primaryMuscle!] });
      }

      router.back();
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim().length > 0 && primaryMuscle !== null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: spacing[5], paddingBottom: spacing[3], borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>New Exercise</Text>
        <Pressable
          onPress={handleSave} disabled={!canSave || saving}
          style={[styles.saveBtn, { backgroundColor: canSave ? colors.text : colors.surface, borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: spacing[2], opacity: saving ? 0.6 : 1 }]}
        >
          {saving ? <ActivityIndicator size="small" color={colors.background} /> : (
            <Text style={{ color: canSave ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <Eyebrow>Exercise Name *</Eyebrow>
        <TextInput
          value={name}
          onChangeText={(v) => { setName(v); setNameError(null); }}
          placeholder="e.g. Incline Dumbbell Press"
          placeholderTextColor={colors.textMuted}
          autoFocus
          style={{ backgroundColor: colors.surface, color: colors.text, fontSize: fontSize.base, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginBottom: nameError ? spacing[1] : spacing[5] }}
        />
        {nameError && <Text style={{ color: colors.danger, fontSize: fontSize.xs, marginBottom: spacing[4] }}>{nameError}</Text>}

        {/* Primary muscle */}
        <Eyebrow style={{ marginBottom: spacing[3] }}>Primary Muscle *</Eyebrow>
        <View style={[styles.chipWrap, { marginBottom: spacing[5] }]}>
          {MUSCLE_OPTIONS.map((m) => (
            <Chip
              key={m}
              label={MUSCLE_GROUP_LABELS[m] ?? m}
              active={primaryMuscle === m}
              onPress={() => setPrimaryMuscle(m)}
              style={{ paddingVertical: spacing[2] }}
            />
          ))}
        </View>

        {/* Secondary muscles */}
        <Eyebrow style={{ marginBottom: spacing[3] }}>Secondary Muscles{' '}<Text style={{ fontWeight: '400', textTransform: 'none' }}>(optional)</Text></Eyebrow>
        <View style={[styles.chipWrap, { marginBottom: spacing[5] }]}>
          {MUSCLE_OPTIONS.filter((m) => m !== primaryMuscle).map((m) => {
            const active = secondaryMuscles.includes(m);
            return (
              <Pressable
                key={m}
                onPress={() => toggleSecondary(m)}
                style={[styles.chip, { backgroundColor: active ? colors.surface : 'transparent', borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderWidth: 1, borderColor: active ? colors.text : colors.border }]}
              >
                <Text style={{ color: active ? colors.text : colors.textMuted, fontSize: fontSize.sm }}>
                  {MUSCLE_GROUP_LABELS[m] ?? m}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Equipment */}
        <Eyebrow style={{ marginBottom: spacing[3] }}>Equipment{' '}<Text style={{ fontWeight: '400', textTransform: 'none' }}>(optional)</Text></Eyebrow>
        <View style={[styles.chipWrap, { marginBottom: spacing[5] }]}>
          {EQUIPMENT_OPTIONS.map((e) => (
            <Chip
              key={e}
              label={e}
              active={equipment === e}
              onPress={() => setEquipment(equipment === e ? null : e)}
              style={{ paddingVertical: spacing[2] }}
            />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  saveBtn: {},
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {},
});
