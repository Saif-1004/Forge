-- ============================================================
-- 007 — Backfill onboarding_completed_at for existing users
-- Any user with a display_name or workout sessions already
-- has enough data — mark them as onboarding complete so they
-- skip the new onboarding flow and land on the home screen.
-- ============================================================

UPDATE users
SET onboarding_completed_at = now()
WHERE onboarding_completed_at IS NULL
  AND (
    display_name IS NOT NULL
    OR id IN (SELECT DISTINCT user_id FROM workout_sessions)
  );
