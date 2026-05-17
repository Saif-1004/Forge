import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { database } from '@/lib/watermelon/database';
import { useWorkoutStore } from '@/store/workoutStore';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { Exercise, SessionExercise } from '@/lib/watermelon/models';
import { Chip } from '@/components/ui';

const ALL = 'all';

const FILTER_GROUPS = [
  ALL,
  'chest',
  'lats',
  'mid_back',
  'lower_back',
  'front_delt',
  'mid_delt',
  'rear_delt',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'core',
  'calves',
  'cardio',
];

export default function ExercisePickerScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { editSessionId } = useLocalSearchParams<{ editSessionId?: string }>();
  const { addExercise, exercises: activeExercises } = useWorkoutStore();

  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

  const filterScrollRef = useRef<ScrollView>(null);
  const chipOffsetsRef = useRef<Map<string, number>>(new Map());

  // For active session: block re-adding already-added exercises
  const activeIds = new Set(activeExercises.map((e) => e.exerciseId));

  useEffect(() => {
    const load = async () => {
      const collection = database.collections.get<Exercise>('exercises');
      const results = await collection.query().fetch();
      results.sort((a, b) => a.name.localeCompare(b.name));
      setAllExercises(results);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = allExercises.filter((ex) => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === ALL || ex.musclePrimary.includes(filter);
    return matchSearch && matchFilter;
  });

  const handleAdd = useCallback(
    async (ex: Exercise) => {
      setAdding(ex.id);
      try {
        if (editSessionId) {
          // Adding to a past (edit) session — write directly to DB
          const seCol = database.collections.get<SessionExercise>('session_exercises');
          const existingSes = await seCol
            .query(Q.where('session_id', editSessionId), Q.where('is_deleted', false))
            .fetchCount();
          await database.write(async () => {
            await seCol.create((record) => {
              record.sessionId = editSessionId;
              record.exerciseId = ex.id;
              record.exerciseRemoteId = ex.remoteId;
              record.orderIndex = existingSes;
              record.notes = null;
              record.isDeleted = false;
              record.remoteId = null;
              record.syncedAt = null;
            });
          });
        } else {
          await addExercise({
            id: ex.id,
            name: ex.name,
            musclePrimary: ex.musclePrimary,
          });
        }
      } finally {
        setAdding(null);
      }
      router.back();
    },
    [addExercise, editSessionId],
  );

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
          Add Exercise
        </Text>
        <Pressable
          onPress={() => router.push({ pathname: '/workout/create-exercise', params: editSessionId ? { editSessionId } : {} })}
          style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }]}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>+ Create</Text>
        </Pressable>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomColor: colors.border, borderBottomWidth: 1 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textMuted}
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              fontSize: fontSize.base,
              borderRadius: radius.lg,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
            },
          ]}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Muscle group filters */}
      <ScrollView
        ref={filterScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingVertical: spacing[3], gap: spacing[2], alignItems: 'center' }}
        style={{ flexShrink: 0, flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        {FILTER_GROUPS.map((item) => (
          <Chip
            key={item}
            label={item === ALL ? 'All' : MUSCLE_GROUP_LABELS[item] ?? item}
            active={filter === item}
            variant="outline"
            onPress={() => {
              setFilter(item);
              const x = chipOffsetsRef.current.get(item) ?? 0;
              filterScrollRef.current?.scrollTo({ x: Math.max(0, x - spacing[5]), animated: true });
            }}
            onLayout={(e) => {
              chipOffsetsRef.current.set(item, e.nativeEvent.layout.x);
            }}
            style={{ paddingHorizontal: spacing[4], paddingVertical: spacing[2] }}
          />
        ))}
      </ScrollView>

      {/* Exercise list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          renderItem={({ item }) => {
            const alreadyAdded = activeIds.has(item.id);
            const isAdding = adding === item.id;
            return (
              <Pressable
                onPress={() => !alreadyAdded && handleAdd(item)}
                disabled={alreadyAdded || isAdding}
                style={({ pressed }) => [
                  styles.exerciseRow,
                  { paddingVertical: spacing[4], opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: alreadyAdded ? colors.textMuted : colors.text,
                      fontSize: fontSize.base,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {item.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 }}>
                    {item.musclePrimary.map((m) => MUSCLE_GROUP_LABELS[m] ?? m).join(' · ')}
                    {item.equipment ? ` · ${item.equipment}` : ''}
                  </Text>
                </View>
                {alreadyAdded ? (
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Added</Text>
                ) : isAdding ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <Text style={{ color: colors.text, fontSize: fontSize['2xl'], lineHeight: 28 }}>+</Text>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={[styles.center, { marginTop: spacing[12] }]}>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.base }}>
                No exercises found
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  searchInput: { },
  exerciseRow: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
