import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { PrimaryGoal } from '@/lib/supabase/types';

interface GoalUpdate {
  primaryGoal?: PrimaryGoal | null;
  goalWeightKg?: number | null;
  weightChangeRateKgPerWeek?: number | null;
  trainingDaysPerWeek?: number | null;
  equipmentAccess?: string[];
  bodyWeightKg?: number | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  onboardingCompleted: boolean;
  unitPreference: 'kg' | 'lbs';
  displayName: string | null;
  photoUrl: string | null;
  primaryGoal: PrimaryGoal | null;
  goalWeightKg: number | null;
  weightChangeRateKgPerWeek: number | null;
  trainingDaysPerWeek: number | null;
  equipmentAccess: string[];
  bodyWeightKg: number | null;
  heightCm: number | null;
  setSession: (session: Session | null) => Promise<void>;
  setOnboardingCompleted: (value: boolean) => void;
  updateDisplayName: (name: string) => Promise<void>;
  updateUnitPreference: (pref: 'kg' | 'lbs') => Promise<void>;
  updateGoals: (patch: GoalUpdate) => Promise<void>;
  updatePhotoUrl: (url: string | null) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  onboardingCompleted: false,
  unitPreference: 'kg',
  displayName: null,
  photoUrl: null,
  primaryGoal: null,
  goalWeightKg: null,
  weightChangeRateKgPerWeek: null,
  trainingDaysPerWeek: null,
  equipmentAccess: [],
  bodyWeightKg: null,
  heightCm: null,

  setSession: async (session) => {
    if (!session) {
      set({
        session: null, user: null, isLoading: false,
        onboardingCompleted: false, unitPreference: 'kg', displayName: null, photoUrl: null,
        primaryGoal: null, goalWeightKg: null, weightChangeRateKgPerWeek: null,
        trainingDaysPerWeek: null, equipmentAccess: [], bodyWeightKg: null, heightCm: null,
      });
      return;
    }
    set({ session, user: session.user, isLoading: true });
    try {
      const { data } = await supabase
        .from('users')
        .select(
          'onboarding_completed_at, unit_system, display_name, photo_url, primary_goal, goal_weight_kg, weight_change_rate_kg_per_week, training_days_per_week, equipment_access, weight_kg, height_cm',
        )
        .eq('id', session.user.id)
        .maybeSingle() as {
          data: {
            onboarding_completed_at: string | null;
            unit_system: 'imperial' | 'metric' | null;
            display_name: string | null;
            photo_url: string | null;
            primary_goal: PrimaryGoal | null;
            goal_weight_kg: number | null;
            weight_change_rate_kg_per_week: number | null;
            training_days_per_week: number | null;
            equipment_access: string[] | null;
            weight_kg: number | null;
            height_cm: number | null;
          } | null
        };

      set({
        onboardingCompleted: !!data?.onboarding_completed_at,
        unitPreference: data?.unit_system === 'metric' ? 'kg' : 'lbs',
        displayName: data?.display_name ?? null,
        photoUrl: data?.photo_url ?? null,
        primaryGoal: data?.primary_goal ?? null,
        goalWeightKg: data?.goal_weight_kg ?? null,
        weightChangeRateKgPerWeek: data?.weight_change_rate_kg_per_week ?? null,
        trainingDaysPerWeek: data?.training_days_per_week ?? null,
        equipmentAccess: data?.equipment_access ?? [],
        bodyWeightKg: data?.weight_kg ?? null,
        heightCm: data?.height_cm ?? null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  setOnboardingCompleted: (value) => set({ onboardingCompleted: value }),

  updateDisplayName: async (name) => {
    const { user } = get();
    if (!user) return;
    const trimmed = name.trim();
    await supabase.from('users').update({ display_name: trimmed || null }).eq('id', user.id);
    set({ displayName: trimmed || null });
  },

  updateUnitPreference: async (pref) => {
    const { user } = get();
    if (!user) return;
    await supabase.from('users').update({ unit_system: pref === 'kg' ? 'metric' : 'imperial', unit_preference: pref }).eq('id', user.id);
    set({ unitPreference: pref });
  },

  updateGoals: async (patch) => {
    const { user } = get();
    if (!user) return;
    await supabase.from('users').update({
      ...(patch.primaryGoal !== undefined ? { primary_goal: patch.primaryGoal } : {}),
      ...(patch.goalWeightKg !== undefined ? { goal_weight_kg: patch.goalWeightKg } : {}),
      ...(patch.weightChangeRateKgPerWeek !== undefined ? { weight_change_rate_kg_per_week: patch.weightChangeRateKgPerWeek } : {}),
      ...(patch.trainingDaysPerWeek !== undefined ? { training_days_per_week: patch.trainingDaysPerWeek } : {}),
      ...(patch.equipmentAccess !== undefined ? { equipment_access: patch.equipmentAccess } : {}),
      ...(patch.bodyWeightKg !== undefined ? { weight_kg: patch.bodyWeightKg } : {}),
    }).eq('id', user.id);
    const storeUpdate: Partial<AuthState> = {};
    if (patch.primaryGoal !== undefined) storeUpdate.primaryGoal = patch.primaryGoal;
    if (patch.goalWeightKg !== undefined) storeUpdate.goalWeightKg = patch.goalWeightKg;
    if (patch.weightChangeRateKgPerWeek !== undefined) storeUpdate.weightChangeRateKgPerWeek = patch.weightChangeRateKgPerWeek;
    if (patch.trainingDaysPerWeek !== undefined) storeUpdate.trainingDaysPerWeek = patch.trainingDaysPerWeek;
    if (patch.equipmentAccess !== undefined) storeUpdate.equipmentAccess = patch.equipmentAccess;
    if (patch.bodyWeightKg !== undefined) storeUpdate.bodyWeightKg = patch.bodyWeightKg;
    set(storeUpdate);
  },

  updatePhotoUrl: async (url) => {
    const { user } = get();
    if (!user) return;
    await supabase.from('users').update({ photo_url: url }).eq('id', user.id);
    set({ photoUrl: url });
  },

  signOut: async () => {
    await supabase.auth.signOut({ scope: 'global' });
    set({ session: null, user: null, onboardingCompleted: false, unitPreference: 'kg', displayName: null, photoUrl: null });
  },
}));
