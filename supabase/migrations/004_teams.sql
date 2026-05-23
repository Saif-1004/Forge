-- ============================================================
-- 004 — Teams additions
-- Adds team_nudges table and cross-user session read policy
-- (teams and team_members tables already exist in 001)
-- ============================================================

CREATE TABLE IF NOT EXISTS team_nudges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_nudges_to_user ON team_nudges(to_user_id, sent_at DESC);

ALTER TABLE team_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_nudges_read" ON team_nudges FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "team_nudges_insert" ON team_nudges FOR INSERT WITH CHECK (
  from_user_id = auth.uid() AND
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

-- Allow team-mates to read each other's workout sessions for leaderboard/feed
CREATE POLICY "sessions_team_read" ON workout_sessions FOR SELECT
USING (
  user_id IN (
    SELECT tm2.user_id FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
  )
);
