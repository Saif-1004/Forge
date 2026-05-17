import { Q } from '@nozbe/watermelondb';
import { database } from './database';
import { supabase } from '@/lib/supabase/client';
import type { WorkoutSession, SessionExercise, Set as SetModel, Exercise, PersonalRecord } from './models';

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

export async function syncWorkoutSessions(userId: string): Promise<void> {
  const sessionsCol = database.collections.get<WorkoutSession>('workout_sessions');
  const seCol = database.collections.get<SessionExercise>('session_exercises');
  const setsCol = database.collections.get<SetModel>('sets');
  const exercisesCol = database.collections.get<Exercise>('exercises');

  // Only sync completed, non-deleted, unsynced sessions
  const unsynced = await sessionsCol
    .query(
      Q.where('user_id', userId),
      Q.where('is_deleted', false),
      Q.where('ended_at', Q.notEq(null)),
      Q.where('synced_at', Q.eq(null)),
    )
    .fetch();

  if (unsynced.length === 0) return;

  for (const session of unsynced) {
    try {
      // ── 1. Upsert session ──────────────────────────────────────────────────
      const sessionPayload = {
        ...(session.remoteId ? { id: session.remoteId } : {}),
        user_id: session.userId,
        name: session.name ?? null,
        started_at: msToIso(session.startedAt),
        ended_at: session.endedAt ? msToIso(session.endedAt) : null,
        notes: session.notes ?? null,
      };

      const { data: sessionRow, error: sessionErr } = await supabase
        .from('workout_sessions')
        .upsert(sessionPayload, { onConflict: 'id' })
        .select('id')
        .single();

      if (sessionErr || !sessionRow) continue;

      const sessionRemoteId = sessionRow.id;

      // ── 2. Session exercises ───────────────────────────────────────────────
      const sessionExercises = await seCol
        .query(Q.where('session_id', session.id), Q.where('is_deleted', false))
        .fetch();

      const seRemoteIds: Map<string, string> = new Map(); // localId → remoteId

      for (const se of sessionExercises) {
        // Resolve exercise remote ID
        let exerciseRemoteId = se.exerciseRemoteId;
        if (!exerciseRemoteId) {
          try {
            const ex = await exercisesCol.find(se.exerciseId);
            exerciseRemoteId = ex.remoteId;
          } catch {
            // Exercise not found locally — skip
          }
        }
        if (!exerciseRemoteId) continue;

        const sePayload = {
          ...(se.remoteId ? { id: se.remoteId } : {}),
          session_id: sessionRemoteId,
          exercise_id: exerciseRemoteId,
          order: se.orderIndex,
          notes: se.notes ?? null,
        };

        const { data: seRow, error: seErr } = await supabase
          .from('session_exercises')
          .upsert(sePayload, { onConflict: 'id' })
          .select('id')
          .single();

        if (seErr || !seRow) continue;

        seRemoteIds.set(se.id, seRow.id);

        // ── 3. Sets for this exercise ──────────────────────────────────────
        const sets = await setsCol
          .query(Q.where('session_exercise_id', se.id), Q.where('is_deleted', false))
          .fetch();

        for (const s of sets) {
          const setPayload = {
            ...(s.remoteId ? { id: s.remoteId } : {}),
            session_exercise_id: seRow.id,
            set_number: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            unit: s.unit,
            rpe: s.rpe ?? null,
            is_warmup: s.isWarmup,
            completed_at: msToIso(s.completedAt),
          };

          const { data: setRow, error: setErr } = await supabase
            .from('sets')
            .upsert(setPayload, { onConflict: 'id' })
            .select('id')
            .single();

          if (setErr || !setRow) continue;

          // Mark set synced
          await database.write(async () => {
            await s.update((r) => {
              r.remoteId = setRow.id;
              r.syncedAt = Date.now();
            });
          });
        }

        // Mark session exercise synced
        await database.write(async () => {
          await se.update((r) => {
            r.remoteId = seRow.id;
            r.exerciseRemoteId = exerciseRemoteId!;
            r.syncedAt = Date.now();
          });
        });
      }

      // Mark session synced
      await database.write(async () => {
        await session.update((r) => {
          r.remoteId = sessionRemoteId;
          r.syncedAt = Date.now();
        });
      });
    } catch {
      // Network error or unexpected failure — will retry on next sync
    }
  }

  // ── Sync personal records ────────────────────────────────────────────────
  await syncPersonalRecords(userId);
}

async function syncPersonalRecords(userId: string): Promise<void> {
  const prCol = database.collections.get<PersonalRecord>('personal_records');
  const exercisesCol = database.collections.get<Exercise>('exercises');

  const unsynced = await prCol
    .query(
      Q.where('user_id', userId),
      Q.where('is_deleted', false),
      Q.where('synced_at', Q.eq(null)),
    )
    .fetch();

  for (const pr of unsynced) {
    try {
      let exerciseRemoteId = pr.exerciseRemoteId;
      if (!exerciseRemoteId) {
        try {
          const ex = await exercisesCol.find(pr.exerciseId);
          exerciseRemoteId = ex.remoteId;
        } catch {}
      }
      if (!exerciseRemoteId) continue;

      const payload = {
        ...(pr.remoteId ? { id: pr.remoteId } : {}),
        user_id: userId,
        exercise_id: exerciseRemoteId,
        rep_count: pr.repCount,
        weight: pr.weight,
        unit: pr.unit,
        achieved_at: msToIso(pr.achievedAt),
      };

      const { data: row, error } = await supabase
        .from('personal_records')
        .upsert(payload, { onConflict: 'user_id,exercise_id,rep_count' })
        .select('id')
        .single();

      if (error || !row) continue;

      await database.write(async () => {
        await pr.update((r) => {
          r.remoteId = row.id;
          r.exerciseRemoteId = exerciseRemoteId!;
          r.syncedAt = Date.now();
        });
      });
    } catch {}
  }
}
