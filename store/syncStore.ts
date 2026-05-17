import { create } from 'zustand';
import { syncWorkoutSessions } from '@/lib/watermelon/sync';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface SyncStore {
  status: SyncStatus;
  lastSyncedAt: number | null;
  errorMessage: string | null;
  sync: (userId: string) => Promise<void>;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  status: 'idle',
  lastSyncedAt: null,
  errorMessage: null,

  sync: async (userId) => {
    if (get().status === 'syncing') return;
    set({ status: 'syncing', errorMessage: null });
    try {
      await syncWorkoutSessions(userId);
      set({ status: 'idle', lastSyncedAt: Date.now() });
    } catch (err) {
      set({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Sync failed',
      });
    }
  },
}));
