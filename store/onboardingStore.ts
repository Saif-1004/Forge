import { create } from 'zustand';
import type { Gender, ExperienceLevel, PrimaryGoal, UnitSystem } from '@/lib/supabase/types';

export interface OnboardingData {
  // Step 1 — Name
  displayName: string;
  // Step 2 — Unit system
  unitSystem: UnitSystem;
  // Step 3 — Gender
  gender: Gender | null;
  // Step 4 — Date of birth
  dateOfBirth: string | null;          // ISO date YYYY-MM-DD
  // Step 5 — Height
  heightCm: number | null;
  // Step 6 — Weight
  weightKg: number | null;
  // Step 7 — Experience level
  experienceLevel: ExperienceLevel | null;
  // Step 8 — Primary goal
  primaryGoal: PrimaryGoal | null;
  // Step 9 — Goal weight
  goalWeightKg: number | null;
  // Step 10 — Weight change rate
  weightChangeRateKgPerWeek: number | null;
  // Step 11 — Training days per week
  trainingDaysPerWeek: number | null;
  // Step 12 — Equipment access
  equipmentAccess: string[];
  // Step 13 — Nutrition tracking enabled
  nutritionTrackingEnabled: boolean;
}

interface OnboardingStore {
  data: Partial<OnboardingData>;
  update: (patch: Partial<OnboardingData>) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  data: {
    unitSystem: 'imperial',
    equipmentAccess: [],
    nutritionTrackingEnabled: true,
  },
  update: (patch) => set((s) => ({ data: { ...s.data, ...patch } })),
  reset: () => set({ data: { unitSystem: 'imperial', equipmentAccess: [], nutritionTrackingEnabled: true } }),
}));
