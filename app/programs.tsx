import { useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Modal, StyleSheet, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useWorkoutStore } from '@/store/workoutStore';
import { PROGRAMS, type Program, type ProgramDay } from '@/data/programs';
import { database } from '@/lib/watermelon/database';
import type { Exercise } from '@/lib/watermelon/models';
import { Q } from '@nozbe/watermelondb';

// ── Types ─────────────────────────────────────────────────────────────────────

type ModalView = 'program' | 'day';

const LEVEL_COLORS: Record<string, string> = {
  Beginner: '#22C55E',
  Intermediate: '#F59E0B',
  Advanced: '#EF4444',
};

// ── Single modal with internal navigation ─────────────────────────────────────

function ProgramModal({
  program,
  day,
  view,
  onClose,
  onSelectDay,
  onBackToProgram,
  onStart,
  starting,
}: {
  program: Program | null;
  day: ProgramDay | null;
  view: ModalView;
  onClose: () => void;
  onSelectDay: (day: ProgramDay) => void;
  onBackToProgram: () => void;
  onStart: (day: ProgramDay) => void;
  starting: boolean;
}) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  if (!program) return null;
  const levelColor = LEVEL_COLORS[program.level] ?? colors.text;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View style={[styles.header, {
          paddingTop: insets.top + 16,
          paddingHorizontal: spacing[5],
          paddingBottom: spacing[4],
          borderBottomColor: colors.border,
        }]}>
          <Pressable onPress={view === 'day' ? onBackToProgram : onClose} hitSlop={12}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>
              {view === 'day' ? '←' : '✕'}
            </Text>
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing[4] }}>
            <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold }}>
              {view === 'day' && day ? day.label : program.name}
            </Text>
            {view === 'day' && day && (
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                {day.focus}
              </Text>
            )}
          </View>
        </View>

        {/* Program detail view */}
        {view === 'program' && (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: insets.bottom + 40 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginBottom: spacing[4] }}>
              {[
                { label: program.level, color: levelColor },
                { label: program.frequency, color: colors.textMuted },
                { label: program.goal, color: colors.textMuted },
                { label: program.duration, color: colors.textMuted },
              ].map((b, i) => (
                <View key={i} style={{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1] }}>
                  <Text style={{ color: b.color, fontSize: fontSize.xs, fontWeight: fontWeight.medium }}>{b.label}</Text>
                </View>
              ))}
            </View>

            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 22, marginBottom: spacing[5] }}>
              {program.description}
            </Text>

            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing[3] }}>
              WORKOUTS
            </Text>
            {program.days.map((d, i) => (
              <Pressable
                key={i}
                onPress={() => onSelectDay(d)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? colors.border : colors.surface,
                  borderRadius: radius.lg,
                  padding: spacing[4],
                  marginBottom: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: 2 }}>
                    {d.label}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                    {d.focus}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                    {d.exercises.length} exercises
                  </Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Day detail view */}
        {view === 'day' && day && (
          <>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: insets.bottom + 100 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing[3] }}>
                {day.exercises.length} EXERCISES
              </Text>
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing[4] }}>
                {day.exercises.map((ex, i) => (
                  <View
                    key={i}
                    style={{
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[4],
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: colors.background,
                      alignItems: 'center', justifyContent: 'center',
                      marginRight: spacing[3], flexShrink: 0,
                    }}>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
                        {i + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.medium, marginBottom: 2 }}>
                        {ex.name}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                        {ex.sets} sets × {ex.reps} · Rest {ex.rest}
                        {ex.notes ? ` · ${ex.notes}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>

            {/* Start button */}
            <View style={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 16, paddingTop: spacing[4], borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
              <Pressable
                onPress={() => onStart(day)}
                disabled={starting}
                style={({ pressed }) => ({
                  backgroundColor: colors.text,
                  borderRadius: radius.lg,
                  paddingVertical: spacing[4],
                  alignItems: 'center',
                  opacity: pressed || starting ? 0.8 : 1,
                })}
              >
                <Text style={{ color: colors.background, fontSize: fontSize.base, fontWeight: fontWeight.bold }}>
                  {starting ? 'Starting…' : 'Start This Workout'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProgramsScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, unitPreference } = useAuthStore();
  const { isActive, startSession } = useWorkoutStore();

  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedDay, setSelectedDay] = useState<ProgramDay | null>(null);
  const [modalView, setModalView] = useState<ModalView>('program');
  const [starting, setStarting] = useState(false);

  const openProgram = (p: Program) => {
    setSelectedProgram(p);
    setSelectedDay(null);
    setModalView('program');
  };

  const openDay = (day: ProgramDay) => {
    setSelectedDay(day);
    setModalView('day');
  };

  const closeModal = () => {
    setSelectedProgram(null);
    setSelectedDay(null);
  };

  const handleStartDay = async (day: ProgramDay) => {
    if (!user) return;
    if (isActive) {
      Alert.alert(
        'Workout in progress',
        'Finish or discard your current workout first.',
        [{ text: 'OK' }, { text: 'Go to workout', onPress: () => { closeModal(); router.push('/workout/active'); } }],
      );
      return;
    }
    setStarting(true);
    try {
      await startSession(user.id, unitPreference);
      const exCol = database.collections.get<Exercise>('exercises');
      for (const pe of day.exercises) {
        const matches = await exCol
          .query(Q.where('name', pe.name), Q.where('is_deleted', false))
          .fetch();
        if (matches.length > 0) {
          const ex = matches[0];
          await useWorkoutStore.getState().addExercise({
            id: ex.id,
            name: ex.name,
            musclePrimary: ex.musclePrimary,
          });
          const { exercises } = useWorkoutStore.getState();
          const added = exercises.find(e => e.exerciseId === ex.id);
          if (added) {
            for (let i = 0; i < pe.sets; i++) {
              useWorkoutStore.getState().addSet(added.sessionExerciseId);
            }
          }
        }
      }
      closeModal();
      router.replace('/workout/active');
    } catch {
      Alert.alert('Error', 'Could not start workout. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const BEGINNER = PROGRAMS.filter(p => p.level === 'Beginner');
  const INTERMEDIATE = PROGRAMS.filter(p => p.level === 'Intermediate');
  const ADVANCED = PROGRAMS.filter(p => p.level === 'Advanced');

  const renderSection = (title: string, programs: Program[]) => {
    if (programs.length === 0) return null;
    return (
      <>
        <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing[3], marginTop: spacing[5] }}>
          {title}
        </Text>
        {programs.map(p => {
          const levelColor = LEVEL_COLORS[p.level] ?? colors.text;
          return (
            <Pressable
              key={p.id}
              onPress={() => openProgram(p)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.border : colors.surface,
                borderRadius: radius.xl,
                padding: spacing[4],
                marginBottom: spacing[3],
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[2] }}>
                <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.bold, flex: 1 }}>
                  {p.name}
                </Text>
                <View style={{ backgroundColor: levelColor + '22', borderRadius: radius.md, paddingHorizontal: spacing[2], paddingVertical: 2 }}>
                  <Text style={{ color: levelColor, fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>
                    {p.level}
                  </Text>
                </View>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginBottom: spacing[3] }}>
                {p.description}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{p.frequency}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>·</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{p.goal}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>·</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{p.duration}</Text>
              </View>
            </Pressable>
          );
        })}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, {
        paddingTop: insets.top + 12,
        paddingHorizontal: spacing[5],
        paddingBottom: spacing[3],
        borderBottomColor: colors.border,
      }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3] }}>
          Programs
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: spacing[4], marginBottom: spacing[2] }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 22 }}>
            Choose a structured program, pick a day, and start your session — sets and exercises load automatically.
          </Text>
        </View>
        {renderSection('BEGINNER', BEGINNER)}
        {renderSection('INTERMEDIATE', INTERMEDIATE)}
        {renderSection('ADVANCED', ADVANCED)}
      </ScrollView>

      {/* Single modal — no stacking */}
      <ProgramModal
        program={selectedProgram}
        day={selectedDay}
        view={modalView}
        onClose={closeModal}
        onSelectDay={openDay}
        onBackToProgram={() => setModalView('program')}
        onStart={handleStartDay}
        starting={starting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
});
