import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import type { PrimaryGoal } from '@/lib/supabase/types';

const GOAL_OPTIONS: { value: PrimaryGoal; label: string; emoji: string; description: string }[] = [
  { value: 'muscle', label: 'Build muscle', emoji: '💪', description: 'Gain strength and size' },
  { value: 'fat_loss', label: 'Lose fat', emoji: '🔥', description: 'Reduce body fat' },
  { value: 'endurance', label: 'Improve endurance', emoji: '🏃', description: 'Cardio and stamina' },
  { value: 'athletic', label: 'Athletic performance', emoji: '⚡', description: 'Speed, power, agility' },
  { value: 'consistency', label: 'Build consistency', emoji: '📅', description: 'Form the workout habit' },
];

const LOSE_RATES = [
  { rateKg: -0.25, label: '0.25 kg/wk', description: 'Gentle' },
  { rateKg: -0.5, label: '0.5 kg/wk', description: 'Recommended' },
  { rateKg: -0.75, label: '0.75 kg/wk', description: 'Faster' },
  { rateKg: -1.0, label: '1 kg/wk', description: 'Aggressive' },
];

const GAIN_RATES = [
  { rateKg: 0.125, label: '0.125 kg/wk', description: 'Lean' },
  { rateKg: 0.25, label: '0.25 kg/wk', description: 'Moderate' },
  { rateKg: 0.5, label: '0.5 kg/wk', description: 'Aggressive' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'full_gym', label: 'Full gym', emoji: '🏋️' },
  { value: 'barbell', label: 'Barbell + rack', emoji: '🏗️' },
  { value: 'dumbbells', label: 'Dumbbells', emoji: '💪' },
  { value: 'bodyweight', label: 'Bodyweight', emoji: '🤸' },
  { value: 'resistance_bands', label: 'Bands', emoji: '🔄' },
  { value: 'kettlebells', label: 'Kettlebells', emoji: '🔔' },
];

function kgToDisplay(kg: number, isImperial: boolean): string {
  return isImperial ? String(Math.round((kg / 0.453592) * 10) / 10) : String(kg);
}

function displayToKg(val: string, isImperial: boolean): number {
  const n = parseFloat(val);
  return isImperial ? Math.round(n * 0.453592 * 10) / 10 : n;
}

export default function GoalsScreen() {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    unitPreference,
    primaryGoal, goalWeightKg, weightChangeRateKgPerWeek,
    trainingDaysPerWeek, equipmentAccess,
    updateGoals,
  } = useAuthStore();

  const isImperial = unitPreference === 'lbs';
  const weightUnit = isImperial ? 'lbs' : 'kg';

  const [editingGoalWeight, setEditingGoalWeight] = useState(false);
  const [goalWeightInput, setGoalWeightInput] = useState(
    goalWeightKg != null ? kgToDisplay(goalWeightKg, isImperial) : '',
  );
  const [savingGoalWeight, setSavingGoalWeight] = useState(false);

  const handleGoalSelect = async (goal: PrimaryGoal) => {
    await updateGoals({ primaryGoal: goal });
  };

  const handleSaveGoalWeight = async () => {
    const n = parseFloat(goalWeightInput);
    if (isNaN(n) || n < 20 || n > (isImperial ? 660 : 300)) {
      Alert.alert('Invalid weight', `Enter a weight between ${isImperial ? '44–660 lbs' : '20–300 kg'}`);
      return;
    }
    setSavingGoalWeight(true);
    try {
      await updateGoals({ goalWeightKg: displayToKg(goalWeightInput, isImperial) });
    } finally {
      setSavingGoalWeight(false);
      setEditingGoalWeight(false);
    }
  };

  const handleRateSelect = async (rate: number) => {
    await updateGoals({ weightChangeRateKgPerWeek: rate });
  };

  const handleTrainingDays = async (days: number) => {
    await updateGoals({ trainingDaysPerWeek: days });
  };

  const handleEquipmentToggle = async (value: string) => {
    const current = equipmentAccess ?? [];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    await updateGoals({ equipmentAccess: next });
  };

  const rateOptions = primaryGoal === 'muscle' ? GAIN_RATES : LOSE_RATES;
  const showRate = primaryGoal === 'muscle' || primaryGoal === 'fat_loss';

  const s = spacing;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, paddingHorizontal: s[5], paddingBottom: s[3], borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>←</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginLeft: s[3] }}>
          My Goals
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s[5], paddingTop: s[5], paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Training Goal */}
        <SectionLabel label="TRAINING GOAL" colors={colors} fontSize={fontSize} spacing={s} />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: s[5] }}>
          {GOAL_OPTIONS.map((opt, i) => {
            const active = primaryGoal === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => handleGoalSelect(opt.value)}
                style={({ pressed }) => [
                  styles.listRow,
                  {
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                    backgroundColor: active ? colors.text + '10' : pressed ? colors.border + '40' : 'transparent',
                  },
                ]}
              >
                <Text style={{ fontSize: fontSize.lg, marginRight: s[3] }}>{opt.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: fontSize.base, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                    {opt.label}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, marginTop: 1 }}>
                    {opt.description}
                  </Text>
                </View>
                {active && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.background, fontSize: 11, fontWeight: '700' }}>✓</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Goal Weight */}
        <SectionLabel label="GOAL WEIGHT" colors={colors} fontSize={fontSize} spacing={s} />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: s[5] }}>
          {editingGoalWeight ? (
            <View style={[styles.listRow]}>
              <TextInput
                value={goalWeightInput}
                onChangeText={setGoalWeightInput}
                keyboardType="decimal-pad"
                autoFocus
                style={{ color: colors.text, fontSize: fontSize.base, flex: 1, padding: 0 }}
                placeholder={`e.g. 75 ${weightUnit}`}
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleSaveGoalWeight}
              />
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, marginRight: s[3] }}>{weightUnit}</Text>
              {savingGoalWeight ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <View style={styles.row}>
                  <Pressable onPress={() => setEditingGoalWeight(false)} hitSlop={8}>
                    <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveGoalWeight} hitSlop={8} style={{ marginLeft: s[4] }}>
                    <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Save</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setGoalWeightInput(goalWeightKg != null ? kgToDisplay(goalWeightKg, isImperial) : '');
                setEditingGoalWeight(true);
              }}
              style={styles.listRow}
            >
              <Text style={{ color: goalWeightKg != null ? colors.text : colors.textMuted, fontSize: fontSize.base, flex: 1 }}>
                {goalWeightKg != null ? `${kgToDisplay(goalWeightKg, isImperial)} ${weightUnit}` : 'Not set'}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>Edit</Text>
            </Pressable>
          )}
        </View>

        {/* Rate of change */}
        {showRate && (
          <>
            <SectionLabel label="RATE OF CHANGE" colors={colors} fontSize={fontSize} spacing={s} />
            <View style={[styles.row, { flexWrap: 'wrap', gap: s[2], marginBottom: s[5] }]}>
              {rateOptions.map((r) => {
                const active = weightChangeRateKgPerWeek === r.rateKg;
                return (
                  <Pressable
                    key={r.rateKg}
                    onPress={() => handleRateSelect(r.rateKg)}
                    style={{ backgroundColor: active ? colors.text : colors.surface, borderRadius: radius.md, paddingVertical: s[2], paddingHorizontal: s[4] }}
                  >
                    <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                      {r.label}
                    </Text>
                    <Text style={{ color: active ? colors.background + 'AA' : colors.textMuted + '88', fontSize: fontSize.xs, textAlign: 'center' }}>
                      {r.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Training days */}
        <SectionLabel label="TRAINING DAYS / WEEK" colors={colors} fontSize={fontSize} spacing={s} />
        <View style={[styles.row, { gap: s[2], marginBottom: s[5] }]}>
          {[2, 3, 4, 5, 6].map((d) => {
            const active = trainingDaysPerWeek === d;
            return (
              <Pressable
                key={d}
                onPress={() => handleTrainingDays(d)}
                style={{ flex: 1, backgroundColor: active ? colors.text : colors.surface, borderRadius: radius.md, paddingVertical: s[3], alignItems: 'center' }}
              >
                <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.base, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                  {d}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Equipment */}
        <SectionLabel label="EQUIPMENT ACCESS" colors={colors} fontSize={fontSize} spacing={s} />
        <View style={[styles.row, { flexWrap: 'wrap', gap: s[2], marginBottom: s[5] }]}>
          {EQUIPMENT_OPTIONS.map((eq) => {
            const active = (equipmentAccess ?? []).includes(eq.value);
            return (
              <Pressable
                key={eq.value}
                onPress={() => handleEquipmentToggle(eq.value)}
                style={{ backgroundColor: active ? colors.text : colors.surface, borderRadius: radius.md, paddingVertical: s[2], paddingHorizontal: s[3] }}
              >
                <Text style={{ color: active ? colors.background : colors.textMuted, fontSize: fontSize.sm, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                  {eq.emoji} {eq.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ label, colors, fontSize, spacing }: { label: string; colors: any; fontSize: any; spacing: any }) {
  return (
    <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600', letterSpacing: 0.8, marginBottom: spacing[2] }}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
});
