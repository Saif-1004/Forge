import { create } from 'zustand';
import { database } from '@/lib/watermelon/database';
import { checkAndUpdatePR } from '@/lib/pr/checkPR';
import type { WorkoutSession, SessionExercise, Set as SetModel } from '@/lib/watermelon/models';

export interface ActiveSet {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;
  unit: 'kg' | 'lbs';
  rpe: number | null;
  isWarmup: boolean;
  durationSeconds: number | null; // cardio only
  loggedAt: number | null;  // null = not yet logged
  isPR?: boolean;
}

export interface ActiveExercise {
  sessionExerciseId: string;
  exerciseId: string;
  exerciseName: string;
  musclePrimary: string[];
  orderIndex: number;
  sets: ActiveSet[];
}

interface WorkoutStore {
  sessionId: string | null;
  userId: string | null;
  sessionName: string | null;
  startedAt: number | null;
  exercises: ActiveExercise[];
  isActive: boolean;
  isPaused: boolean;
  pausedAt: number | null;
  accumulatedPauseMs: number;
  defaultUnit: 'kg' | 'lbs';

  getElapsed: () => number;
  pauseSession: () => void;
  resumeSession: () => void;
  startSession: (userId: string, unit: 'kg' | 'lbs') => Promise<void>;
  finishSession: () => Promise<void>;
  discardSession: () => Promise<void>;
  addExercise: (ex: { id: string; name: string; musclePrimary: string[] }) => Promise<void>;
  removeExercise: (sessionExerciseId: string) => Promise<void>;
  addSet: (sessionExerciseId: string) => void;
  updateSet: (sessionExerciseId: string, setId: string, data: Partial<Omit<ActiveSet, 'id' | 'setNumber'>>) => void;
  logSet: (sessionExerciseId: string, setId: string) => Promise<void>;
  deleteSet: (sessionExerciseId: string, setId: string) => Promise<void>;
  reset: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  sessionId: null,
  userId: null,
  sessionName: null,
  startedAt: null,
  exercises: [],
  isActive: false,
  isPaused: false,
  pausedAt: null,
  accumulatedPauseMs: 0,
  defaultUnit: 'kg',

  getElapsed: () => {
    const { startedAt, isPaused, pausedAt, accumulatedPauseMs } = get();
    if (!startedAt) return 0;
    const base = isPaused ? (pausedAt ?? Date.now()) : Date.now();
    return base - startedAt - accumulatedPauseMs;
  },

  pauseSession: () => {
    const { isPaused } = get();
    if (isPaused) return;
    set({ isPaused: true, pausedAt: Date.now() });
  },

  resumeSession: () => {
    const { isPaused, pausedAt, accumulatedPauseMs } = get();
    if (!isPaused || !pausedAt) return;
    set({
      isPaused: false,
      pausedAt: null,
      accumulatedPauseMs: accumulatedPauseMs + (Date.now() - pausedAt),
    });
  },

  startSession: async (userId, unit) => {
    const now = Date.now();
    const sessionsCollection = database.collections.get<WorkoutSession>('workout_sessions');
    let newSessionId = '';

    await database.write(async () => {
      const session = await sessionsCollection.create((record) => {
        record.userId = userId;
        record.name = null;
        record.startedAt = now;
        record.endedAt = null;
        record.notes = null;
        record.isDeleted = false;
        record.remoteId = null;
        record.syncedAt = null;
      });
      newSessionId = session.id;
    });

    set({ sessionId: newSessionId, userId, startedAt: now, exercises: [], isActive: true, sessionName: null, isPaused: false, pausedAt: null, accumulatedPauseMs: 0, defaultUnit: unit });
  },

  finishSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return;

    const sessionsCollection = database.collections.get<WorkoutSession>('workout_sessions');
    await database.write(async () => {
      const session = await sessionsCollection.find(sessionId);
      await session.update((record) => {
        record.endedAt = Date.now();
      });
    });

    set({ sessionId: null, userId: null, startedAt: null, exercises: [], isActive: false, sessionName: null, isPaused: false, pausedAt: null, accumulatedPauseMs: 0 });
  },

  discardSession: async () => {
    const { sessionId, exercises } = get();
    if (!sessionId) return;

    await database.write(async () => {
      const setsCollection = database.collections.get<SetModel>('sets');
      const seCollection = database.collections.get<SessionExercise>('session_exercises');
      const sessionsCollection = database.collections.get<WorkoutSession>('workout_sessions');

      for (const ex of exercises) {
        const loggedSetIds = ex.sets
          .filter((s) => s.loggedAt !== null)
          .map((s) => s.id);

        for (const setId of loggedSetIds) {
          try {
            const setRecord = await setsCollection.find(setId);
            await setRecord.destroyPermanently();
          } catch {}
        }

        try {
          const seRecord = await seCollection.find(ex.sessionExerciseId);
          await seRecord.destroyPermanently();
        } catch {}
      }

      try {
        const session = await sessionsCollection.find(sessionId);
        await session.destroyPermanently();
      } catch {}
    });

    set({ sessionId: null, userId: null, startedAt: null, exercises: [], isActive: false, sessionName: null, isPaused: false, pausedAt: null, accumulatedPauseMs: 0 });
  },

  addExercise: async (ex) => {
    const { sessionId, exercises } = get();
    if (!sessionId) return;

    const seCollection = database.collections.get<SessionExercise>('session_exercises');
    let newSeId = '';

    await database.write(async () => {
      const se = await seCollection.create((record) => {
        record.sessionId = sessionId;
        record.exerciseId = ex.id;
        record.exerciseRemoteId = null;
        record.orderIndex = exercises.length;
        record.notes = null;
        record.isDeleted = false;
        record.remoteId = null;
        record.syncedAt = null;
      });
      newSeId = se.id;
    });

    const newExercise: ActiveExercise = {
      sessionExerciseId: newSeId,
      exerciseId: ex.id,
      exerciseName: ex.name,
      musclePrimary: ex.musclePrimary,
      orderIndex: exercises.length,
      sets: [],
    };

    set({ exercises: [...exercises, newExercise] });
  },

  removeExercise: async (sessionExerciseId) => {
    const { exercises } = get();
    const target = exercises.find((e) => e.sessionExerciseId === sessionExerciseId);
    if (!target) return;

    await database.write(async () => {
      const setsCollection = database.collections.get<SetModel>('sets');
      for (const s of target.sets.filter((s) => s.loggedAt !== null)) {
        try {
          const setRecord = await setsCollection.find(s.id);
          await setRecord.destroyPermanently();
        } catch {}
      }
      const seCollection = database.collections.get<SessionExercise>('session_exercises');
      try {
        const se = await seCollection.find(sessionExerciseId);
        await se.destroyPermanently();
      } catch {}
    });

    set({ exercises: exercises.filter((e) => e.sessionExerciseId !== sessionExerciseId) });
  },

  addSet: (sessionExerciseId) => {
    const { exercises, defaultUnit } = get();
    set({
      exercises: exercises.map((ex) => {
        if (ex.sessionExerciseId !== sessionExerciseId) return ex;
        const prev = ex.sets[ex.sets.length - 1];
        const newSet: ActiveSet = {
          id: `local_${Date.now()}_${Math.random()}`,
          setNumber: ex.sets.length + 1,
          reps: prev?.reps ?? 10,
          weight: prev?.weight ?? 0,
          unit: prev?.unit ?? defaultUnit,
          rpe: null,
          isWarmup: false,
          durationSeconds: prev?.durationSeconds ?? null,
          loggedAt: null,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      }),
    });
  },

  updateSet: (sessionExerciseId, setId, data) => {
    const { exercises } = get();
    set({
      exercises: exercises.map((ex) => {
        if (ex.sessionExerciseId !== sessionExerciseId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...data } : s)),
        };
      }),
    });
  },

  logSet: async (sessionExerciseId, setId) => {
    const { exercises, userId } = get();
    const ex = exercises.find((e) => e.sessionExerciseId === sessionExerciseId);
    const targetSet = ex?.sets.find((s) => s.id === setId);
    if (!targetSet || targetSet.loggedAt !== null) return;

    const setsCollection = database.collections.get<SetModel>('sets');
    const now = Date.now();
    let newDbId = '';

    await database.write(async () => {
      const setRecord = await setsCollection.create((record) => {
        record.sessionExerciseId = sessionExerciseId;
        record.setNumber = targetSet.setNumber;
        record.reps = targetSet.reps;
        record.weight = targetSet.weight;
        record.unit = targetSet.unit;
        record.rpe = targetSet.rpe;
        record.isWarmup = targetSet.isWarmup;
        record.durationSeconds = targetSet.durationSeconds ?? null;
        record.completedAt = now;
        record.isDeleted = false;
        record.remoteId = null;
        record.syncedAt = null;
      });
      newDbId = setRecord.id;
    });

    // Check for PR (skip warmup sets)
    let isPR = false;
    if (userId && ex && !targetSet.isWarmup && !ex.musclePrimary.includes('cardio')) {
      isPR = await checkAndUpdatePR(
        userId,
        ex.exerciseId,
        null,
        targetSet.reps,
        targetSet.weight,
        targetSet.unit,
      );
    }

    set({
      exercises: exercises.map((e) => {
        if (e.sessionExerciseId !== sessionExerciseId) return e;
        return {
          ...e,
          sets: e.sets.map((s) =>
            s.id === setId ? { ...s, id: newDbId, loggedAt: now, isPR } : s,
          ),
        };
      }),
    });
  },

  deleteSet: async (sessionExerciseId, setId) => {
    const { exercises } = get();
    const ex = exercises.find((e) => e.sessionExerciseId === sessionExerciseId);
    const targetSet = ex?.sets.find((s) => s.id === setId);
    if (!targetSet) return;

    if (targetSet.loggedAt !== null) {
      const setsCollection = database.collections.get<SetModel>('sets');
      await database.write(async () => {
        try {
          const setRecord = await setsCollection.find(setId);
          await setRecord.destroyPermanently();
        } catch {}
      });
    }

    set({
      exercises: exercises.map((ex) => {
        if (ex.sessionExerciseId !== sessionExerciseId) return ex;
        const filtered = ex.sets.filter((s) => s.id !== setId);
        return {
          ...ex,
          sets: filtered.map((s, i) => ({ ...s, setNumber: i + 1 })),
        };
      }),
    });
  },

  reset: () => {
    set({ sessionId: null, userId: null, startedAt: null, exercises: [], isActive: false, sessionName: null, isPaused: false, pausedAt: null, accumulatedPauseMs: 0, defaultUnit: 'kg' });
  },
}));
