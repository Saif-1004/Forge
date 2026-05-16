import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  onboardingCompleted: boolean;
  setSession: (session: Session | null) => void;
  setOnboardingCompleted: (value: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  onboardingCompleted: false,

  setSession: async (session) => {
    if (!session) {
      set({ session: null, user: null, isLoading: false, onboardingCompleted: false });
      return;
    }
    // Check whether this user has already completed onboarding
    const { data } = await supabase
      .from('users')
      .select('onboarding_completed_at')
      .eq('id', session.user.id)
      .maybeSingle() as { data: { onboarding_completed_at: string | null } | null };

    set({
      session,
      user: session.user,
      isLoading: false,
      onboardingCompleted: !!data?.onboarding_completed_at,
    });
  },

  setOnboardingCompleted: (value) => set({ onboardingCompleted: value }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, onboardingCompleted: false });
  },
}));
