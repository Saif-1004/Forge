import type { OnboardingData } from '@/store/onboardingStore';

interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const ACTIVITY_MULTIPLIERS: Record<number, number> = {
  2: 1.375,
  3: 1.55,
  4: 1.65,
  5: 1.725,
  6: 1.8,
};

export function computeNutritionTargets(data: Partial<OnboardingData>): NutritionTargets | null {
  const { weightKg, heightCm, dateOfBirth, gender, trainingDaysPerWeek, weightChangeRateKgPerWeek } = data;
  if (!weightKg || !heightCm) return null;

  // Mifflin-St Jeor BMR
  const age = dateOfBirth
    ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 30;

  const bmr = gender === 'female'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
    : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;

  const activityMultiplier = ACTIVITY_MULTIPLIERS[trainingDaysPerWeek ?? 3] ?? 1.55;
  const tdee = bmr * activityMultiplier;

  // Adjust for weight change rate (1 kg fat ≈ 7700 kcal)
  const rateKcal = (weightChangeRateKgPerWeek ?? 0) * 7700 / 7;
  const targetCalories = Math.round(tdee + rateKcal);

  // Protein: 2.2 g/kg bodyweight (muscle building / preservation)
  const protein = Math.round(weightKg * 2.2);
  // Fat: 25% of calories
  const fat = Math.round((targetCalories * 0.25) / 9);
  // Carbs: remainder
  const carbCalories = targetCalories - protein * 4 - fat * 9;
  const carbs = Math.max(0, Math.round(carbCalories / 4));

  return { calories: targetCalories, protein, carbs, fat };
}
