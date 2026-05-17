import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  onboardingCompleted: boolean;
  unitPreference: 'kg' | 'lbs';
  displayName: string | null;
  setSession: (session: Session | null) => Promise<void>;
  setOnboardingCompleted: (value: boolean) => void;
  updateDisplayName: (name: string) => Promise<void>;
  updateUnitPreference: (pref: 'kg' | 'lbs') => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,
  onboardingCompleted: false,
  unitPreference: 'kg',
  displayName: null,

  setSession: async (session) => {
    if (!session) {
      set({ session: null, user: null, isLoading: false, onboardingCompleted: false, unitPreference: 'kg', displayName: null });
      return;
    }
    set({ isLoading: true });
    try {
      const { data } = await supabase
        .from('users')
        .select('onboarding_completed_at, unit_system, display_name')
        .eq('id', session.user.id)
        .maybeSingle() as { data: { onboarding_completed_at: string | null; unit_system: 'imperial' | 'metric' | null; display_name: string | null } | null };

      set({
        session,
        user: session.user,
        onboardingCompleted: !!data?.onboarding_completed_at,
        unitPreference: data?.unit_system === 'metric' ? 'kg' : 'lbs',
        displayName: data?.display_name ?? null,
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

  signOut: async () => {
    await supabase.auth.signOut({ scope: 'global' });
    set({ session: null, user: null, onboardingCompleted: false, unitPreference: 'kg', displayName: null });
  },
}));
