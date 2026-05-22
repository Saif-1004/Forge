import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { database } from '@/lib/watermelon/database';
import type { FoodLog, WaterLog } from '@/lib/watermelon/models';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEALS: { key: MealType; label: string; emoji: string }[] = [
  { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { key: 'lunch', label: 'Lunch', emoji: '☀️' },
  { key: 'dinner', label: 'Dinner', emoji: '🌙' },
  { key: 'snack', label: 'Snacks', emoji: '🍎' },
];

const WATER_AMOUNTS = [150, 250, 500, 750];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDateLabel(date: Date): string {
  const today = toISODate(new Date());
  const ds = toISODate(date);
  if (ds === today) return 'Today';
  if (ds === toISODate(addDays(new Date(), -1))) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

interface FoodLogItem {
  id: string;
  foodName: string;
  mealType: MealType;
  servingG: number;
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface DayData {
  logs: FoodLogItem[];
  waterMl: number;
  waterLogIds: string[];
}

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const { colors, fontSize, fontWeight } = useTheme();
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 4 }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: 4 }}>
        {Math.round(value)}<Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.normal }}>g</Text>
      </Text>
      <View style={{ height: 4, width: '100%', backgroundColor: colors.border, borderRadius: 2 }}>
        <View style={{ height: 4, width: `${pct * 100}%`, backgroundColor: color, borderRadius: 2 }} />
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 3 }}>/ {goal}g</Text>
    </View>
  );
}

export default function NutritionTab() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { calorieGoal, proteinGoal, carbsGoal, fatGoal, waterGoalMl } = useSettingsStore();

  const [date, setDate] = useState(new Date());
  const [dayData, setDayData] = useState<DayData>({ logs: [], waterMl: 0, waterLogIds: [] });
  const [loading, setLoading] = useState(true);

  const dateStr = toISODate(date);
  const isFuture = dateStr > toISODate(new Date());

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const logsCol = database.collections.get<FoodLog>('food_logs');
      const waterCol = database.collections.get<WaterLog>('water_logs');

      const [rawLogs, rawWater] = await Promise.all([
        logsCol.query(Q.where('user_id', user.id), Q.where('date', dateStr), Q.where('is_deleted', false)).fetch(),
        waterCol.query(Q.where('user_id', user.id), Q.where('date', dateStr), Q.where('is_deleted', false)).fetch(),
      ]);

      setDayData({
        logs: rawLogs.map((l) => ({
          id: l.id,
          foodName: l.foodName,
          mealType: l.mealType as MealType,
          servingG: l.servingG,
          caloriesKcal: l.caloriesKcal,
          proteinG: l.proteinG,
          carbsG: l.carbsG,
          fatG: l.fatG,
        })),
        waterMl: rawWater.reduce((acc, w) => acc + w.amountMl, 0),
        waterLogIds: rawWater.map((w) => w.id),
      });
    } finally {
      setLoading(false);
    }
  }, [user, dateStr]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = dayData.logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.caloriesKcal,
      protein: acc.protein + l.proteinG,
      carbs: acc.carbs + l.carbsG,
      fat: acc.fat + l.fatG,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const handleAddWater = async (ml: number) => {
    if (!user) return;
    const waterCol = database.collections.get<WaterLog>('water_logs');
    await database.write(async () => {
      await waterCol.create((r) => {
        r.userId = user.id;
        r.amountMl = ml;
        r.loggedAt = Date.now();
        r.date = dateStr;
        r.isDeleted = false;
        r.remoteId = null;
        r.syncedAt = null;
      });
    });
    setDayData((prev) => ({ ...prev, waterMl: prev.waterMl + ml }));
  };

  const handleDeleteLog = (item: FoodLogItem) => {
    Alert.alert('Delete entry?', item.foodName, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const logsCol = database.collections.get<FoodLog>('food_logs');
          await database.write(async () => {
            try {
              const r = await logsCol.find(item.id);
              await r.destroyPermanently();
            } catch {}
          });
          setDayData((prev) => ({ ...prev, logs: prev.logs.filter((l) => l.id !== item.id) }));
        },
      },
    ]);
  };

  const handleClearWater = async () => {
    if (dayData.waterLogIds.length === 0) return;
    Alert.alert('Clear water?', 'Remove all water logs for today?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const waterCol = database.collections.get<WaterLog>('water_logs');
          await database.write(async () => {
            for (const id of dayData.waterLogIds) {
              try {
                const r = await waterCol.find(id);
                await r.destroyPermanently();
              } catch {}
            }
          });
          setDayData((prev) => ({ ...prev, waterMl: 0, waterLogIds: [] }));
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
        <Text style={{ color: colors.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold }}>
          Nutrition
        </Text>
      </View>

      {/* Date navigation */}
      <View style={[styles.dateNav, { paddingHorizontal: spacing[5], marginBottom: spacing[4] }]}>
        <Pressable onPress={() => setDate((d) => addDays(d, -1))} hitSlop={12}>
          <Text style={{ color: colors.text, fontSize: fontSize.xl }}>‹</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
          {formatDateLabel(date)}
        </Text>
        <Pressable onPress={() => !isFuture && setDate((d) => addDays(d, 1))} hitSlop={12}>
          <Text style={{ color: isFuture ? colors.border : colors.text, fontSize: fontSize.xl }}>›</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.text} style={{ marginTop: spacing[10] }} />
      ) : (
        <>
          {/* Calorie summary */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, marginHorizontal: spacing[5], padding: spacing[4], marginBottom: spacing[3] }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing[3] }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 2 }}>CALORIES</Text>
                <Text style={{ color: colors.text, fontSize: fontSize['3xl'] ?? 32, fontWeight: fontWeight.bold }}>
                  {Math.round(totals.calories)}
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.normal }}> kcal</Text>
                </Text>
                {calorieGoal > 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 }}>
                    {Math.max(calorieGoal - Math.round(totals.calories), 0) > 0
                      ? `${calorieGoal - Math.round(totals.calories)} remaining`
                      : 'Goal reached ✓'}
                  </Text>
                )}
              </View>
              {/* Net calories chip */}
              {totals.calories > 0 && calorieGoal > 0 && (
                <View style={{ backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[1], alignItems: 'center' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 9, marginBottom: 1 }}>NET</Text>
                  <Text style={{ color: totals.calories <= calorieGoal ? colors.success : colors.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                    {Math.round(totals.calories - calorieGoal) > 0 ? '+' : ''}{Math.round(totals.calories - calorieGoal)}
                  </Text>
                </View>
              )}
            </View>

            {/* Calorie progress bar */}
            {calorieGoal > 0 && (
              <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: spacing[3] }}>
                <View style={{ height: 4, width: `${Math.min(totals.calories / calorieGoal, 1) * 100}%`, backgroundColor: totals.calories > calorieGoal ? colors.error : colors.text, borderRadius: 2 }} />
              </View>
            )}

            {/* Macro bars */}
            <View style={{ flexDirection: 'row', gap: spacing[4] }}>
              <MacroBar label="Protein" value={totals.protein} goal={proteinGoal} color="#3B82F6" />
              <MacroBar label="Carbs" value={totals.carbs} goal={carbsGoal} color="#F59E0B" />
              <MacroBar label="Fat" value={totals.fat} goal={fatGoal} color="#EF4444" />
            </View>
          </View>

          {/* Water */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl, marginHorizontal: spacing[5], padding: spacing[4], marginBottom: spacing[4] }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing[2] }}>
              <View>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginBottom: 2 }}>WATER</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.bold }}>
                    {dayData.waterMl >= 1000 ? `${(dayData.waterMl / 1000).toFixed(1)}L` : `${dayData.waterMl}ml`}
                  </Text>
                  {waterGoalMl > 0 && (
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>
                      / {waterGoalMl >= 1000 ? `${(waterGoalMl / 1000).toFixed(1)}L` : `${waterGoalMl}ml`}
                    </Text>
                  )}
                </View>
                {waterGoalMl > 0 && dayData.waterMl >= waterGoalMl && (
                  <Text style={{ color: colors.success, fontSize: fontSize.xs, marginTop: 2 }}>Goal reached ✓</Text>
                )}
              </View>
              {dayData.waterMl > 0 && (
                <Pressable onPress={handleClearWater} hitSlop={8}>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>Clear</Text>
                </Pressable>
              )}
            </View>
            {/* Water progress bar */}
            {waterGoalMl > 0 && (
              <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: spacing[3] }}>
                <View style={{ height: 4, width: `${Math.min(dayData.waterMl / waterGoalMl, 1) * 100}%`, backgroundColor: '#3B82F6', borderRadius: 2 }} />
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              {WATER_AMOUNTS.map((ml) => (
                <Pressable
                  key={ml}
                  onPress={() => handleAddWater(ml)}
                  style={({ pressed }) => [
                    styles.waterBtn,
                    { flex: 1, backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing[2], opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={{ color: colors.text, fontSize: fontSize.xs, textAlign: 'center', fontWeight: fontWeight.medium }}>
                    +{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Meal sections */}
          {MEALS.map(({ key, label, emoji }) => {
            const mealLogs = dayData.logs.filter((l) => l.mealType === key);
            const mealCal = mealLogs.reduce((a, l) => a + l.caloriesKcal, 0);
            return (
              <View key={key} style={{ marginHorizontal: spacing[5], marginBottom: spacing[4] }}>
                {/* Meal header */}
                <View style={[styles.mealHeader, { marginBottom: spacing[2] }]}>
                  <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: fontWeight.semibold }}>
                    {emoji} {label}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                    {mealCal > 0 && (
                      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{Math.round(mealCal)} kcal</Text>
                    )}
                    <Pressable
                      onPress={() => router.push({ pathname: '/nutrition/log', params: { meal: key, date: dateStr } })}
                      hitSlop={8}
                    >
                      <Text style={{ color: colors.text, fontSize: fontSize.xl, lineHeight: 24 }}>+</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Log items */}
                {mealLogs.length > 0 ? (
                  <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
                    {mealLogs.map((item, i) => (
                      <Pressable
                        key={item.id}
                        onLongPress={() => handleDeleteLog(item)}
                        style={[
                          styles.logItem,
                          {
                            paddingHorizontal: spacing[4],
                            paddingVertical: spacing[3],
                            borderTopWidth: i > 0 ? 1 : 0,
                            borderTopColor: colors.border,
                          },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>{item.foodName}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>
                            {item.servingG}g · P {item.proteinG}g · C {item.carbsG}g · F {item.fatG}g
                          </Text>
                        </View>
                        <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
                          {Math.round(item.caloriesKcal)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Pressable
                    onPress={() => router.push({ pathname: '/nutrition/log', params: { meal: key, date: dateStr } })}
                    style={[styles.emptyMeal, { borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing[3] }]}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Tap to log {label.toLowerCase()}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  card: {},
  waterBtn: { borderWidth: 1, alignItems: 'center' },
  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logItem: { flexDirection: 'row', alignItems: 'center' },
  emptyMeal: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center' },
});
