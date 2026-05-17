import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { database } from '@/lib/watermelon/database';
import { useWorkoutStore } from '@/store/workoutStore';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { Exercise } from '@/lib/watermelon/models';

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
];

export default function ExercisePickerScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { addExercise, exercises: activeExercises } = useWorkoutStore();

  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);

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
      await addExercise({
        id: ex.id,
        name: ex.name,
        musclePrimary: ex.musclePrimary,
      });
      setAdding(null);
      router.back();
    },
    [addExercise],
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
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: spacing[3] }}>
          Add Exercise
        </Text>
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
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTER_GROUPS}
        keyExtractor={(item) => item}
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingVertical: spacing[3], gap: spacing[2] }}
        style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border }}
        renderItem={({ item }) => {
          const active = filter === item;
          return (
            <Pressable
              onPress={() => setFilter(item)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.text : colors.surface,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[2],
                },
              ]}
            >
              <Text
                style={{
                  color: active ? colors.background : colors.textMuted,
                  fontSize: fontSize.sm,
                  fontWeight: active ? fontWeight.semibold : fontWeight.normal,
                }}
              >
                {item === ALL ? 'All' : MUSCLE_GROUP_LABELS[item] ?? item}
              </Text>
            </Pressable>
          );
        }}
      />

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
  filterChip: { },
  exerciseRow: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
