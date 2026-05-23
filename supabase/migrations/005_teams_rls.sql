-- ============================================================
-- 005 — Teams RLS policies
-- The teams table was missing INSERT/SELECT/UPDATE policies
-- and team_members was missing INSERT/DELETE policies.
-- ============================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read a team they belong to
CREATE POLICY "teams_read" ON teams FOR SELECT
  USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

-- Any authenticated user can create a team (created_by must be themselves)
CREATE POLICY "teams_insert" ON teams FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Only the team creator (admin) can update team details
CREATE POLICY "teams_update" ON teams FOR UPDATE
  USING (created_by = auth.uid());

-- Only the team creator can delete the team
CREATE POLICY "teams_delete" ON teams FOR DELETE
  USING (created_by = auth.uid());

-- Allow users to join a team (insert themselves into team_members)
CREATE POLICY "team_members_insert" ON team_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to leave a team (delete their own membership)
CREATE POLICY "team_members_delete" ON team_members FOR DELETE
  USING (user_id = auth.uid());
