-- ============================================================
-- 004 — Teams
-- Adds teams, team_members, team_nudges tables
-- ============================================================

CREATE TABLE IF NOT EXISTS teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  invite_code text UNIQUE NOT NULL DEFAULT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      team_role NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_nudges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_members_user   ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team   ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_nudges_to_user ON team_nudges(to_user_id, sent_at DESC);

-- RLS
ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_nudges  ENABLE ROW LEVEL SECURITY;

-- Teams: members can read, creator can insert, admin can update
CREATE POLICY "teams_read"   ON teams FOR SELECT USING (
  id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "teams_insert" ON teams FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "teams_update" ON teams FOR UPDATE USING (
  id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'admin')
);

-- Team members: team-mates can read, users manage their own membership
CREATE POLICY "team_members_read"   ON team_members FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members tm2 WHERE tm2.user_id = auth.uid())
);
CREATE POLICY "team_members_insert" ON team_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "team_members_delete" ON team_members FOR DELETE USING (user_id = auth.uid());

-- Nudges: team-mates can send/read within shared teams
CREATE POLICY "team_nudges_read"   ON team_nudges FOR SELECT USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
CREATE POLICY "team_nudges_insert" ON team_nudges FOR INSERT WITH CHECK (
  from_user_id = auth.uid() AND
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

-- Allow team-mates to read each other's workout sessions for the feed/leaderboard
CREATE POLICY "sessions_team_read" ON workout_sessions FOR SELECT
USING (
  user_id IN (
    SELECT tm2.user_id FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
  )
);
