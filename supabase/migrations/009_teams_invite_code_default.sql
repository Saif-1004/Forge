-- ============================================================
-- 009 — Add default value for teams.invite_code
-- The column is NOT NULL but had no default, causing INSERT to
-- fail whenever the app didn't supply an invite_code.
-- Generates a 6-char uppercase alphanumeric code automatically.
-- ============================================================

ALTER TABLE teams
  ALTER COLUMN invite_code
  SET DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
